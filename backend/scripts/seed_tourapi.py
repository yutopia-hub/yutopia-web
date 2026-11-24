"""Fetch TourAPI samples, generate repeatable SQL and optionally apply it to yutopia.

Uses only Python's standard library and the installed MySQL command-line client.
Credentials are read from environment variables / ignored .env.local and never printed.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import html
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://www.data.go.kr/data/15101578/openapi.do"
BASE_URL = "https://apis.data.go.kr/B551011/KorService2"
CACHE = ROOT / "target/tourapi-cache"
OUTPUT = ROOT / "src/main/resources/db/seed.sql"
CONTENT_TYPES = {"12": "관광지", "14": "문화시설", "15": "축제공연행사", "25": "여행코스",
                 "28": "레포츠", "32": "숙박", "38": "쇼핑", "39": "음식점"}


class ImportFailure(Exception):
    pass


def local_config():
    config = {}
    path = ROOT / ".env.local"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.lstrip().startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip().strip("\"'")
    config.update(os.environ)
    return config


class TourApi:
    def __init__(self, config, refresh):
        self.key = config.get("TOUR_API_SERVICE_KEY") or config.get("VITE_API_SERVICE_KEY")
        self.base = config.get("TOUR_API_BASE_URL", BASE_URL).rstrip("/")
        self.refresh = refresh
        self.common_timestamps = {}
        if not self.key or self.key == "YOUR_DATA_GO_KR_SERVICE_KEY":
            raise ImportFailure("Set TOUR_API_SERVICE_KEY in .env.local or the environment.")
        if self.base != BASE_URL:
            raise ImportFailure("Use the official KorService2 HTTPS base URL.")
        if config.get("TOUR_API_USE_MOCK", "false").lower() != "false":
            raise ImportFailure("This importer requires TOUR_API_USE_MOCK=false.")
        CACHE.mkdir(parents=True, exist_ok=True)

    def get(self, operation, **parameters):
        query = {"MobileOS": "ETC", "MobileApp": "Yutopia", "_type": "json",
                 "numOfRows": "1000", "pageNo": "1", **parameters}
        fingerprint = hashlib.sha256(json.dumps(query, sort_keys=True).encode()).hexdigest()[:24]
        cache_file = CACHE / f"{operation}-{fingerprint}.json"
        if cache_file.exists() and not self.refresh:
            payload = json.loads(cache_file.read_text(encoding="utf-8"))
        else:
            encoded = urllib.parse.urlencode({**query, "serviceKey": urllib.parse.unquote(self.key)})
            request = urllib.request.Request(self.base + "/" + operation + "?" + encoded,
                                             headers={"User-Agent": "Yutopia-seed/1.0"})
            raw = None
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(request, timeout=25) as response:
                        raw = response.read()
                    break
                except urllib.error.HTTPError as error:
                    if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                        raise ImportFailure(f"{operation}: HTTP {error.code}") from None
                except (urllib.error.URLError, TimeoutError, OSError):
                    if attempt == 2:
                        raise ImportFailure(f"{operation}: network request failed") from None
                time.sleep(attempt + 1)
            try:
                payload = json.loads(raw)
            except (ValueError, TypeError):
                try:
                    code = ET.fromstring(raw).findtext(".//returnReasonCode")
                except (ET.ParseError, TypeError):
                    code = "unknown"
                raise ImportFailure(f"{operation}: non-JSON API error ({code})") from None
            header = payload.get("response", {}).get("header", {})
            if str(header.get("resultCode")) not in ("0000", "00"):
                raise ImportFailure(f"{operation}: API result code {header.get('resultCode', 'missing')}")
            cache_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        if operation == "detailCommon2":
            self.common_timestamps[str(parameters["contentId"])] = datetime.fromtimestamp(
                cache_file.stat().st_mtime, timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")
        body = payload.get("response", {}).get("body", {})
        items = body.get("items") or {}
        rows = items.get("item", []) if isinstance(items, dict) else []
        if isinstance(rows, dict):
            rows = [rows]
        return rows, int(body.get("totalCount", len(rows)))

    def all_codes(self, operation, **parameters):
        result = []
        page = 1
        while True:
            items, total = self.get(operation, pageNo=page, **parameters)
            result.extend(items)
            if len(result) >= total:
                return result
            if not items:
                raise ImportFailure(f"{operation}: incomplete code list")
            page += 1


def text(value, limit=None):
    if value is None:
        return None
    value = re.sub(r"(?i)<br\s*/?>", "\n", str(value))
    value = html.unescape(re.sub(r"<[^>]*>", "", value)).strip()
    return (value[:limit] if limit else value) or None


def safe_url(value):
    if not value:
        return None
    value = html.unescape(str(value)).strip()
    href = re.search(r"href\s*=\s*['\"]([^'\"]+)", value, re.I)
    if href:
        value = href[1]
    elif " " in value or "<" in value:
        match = re.search(r"https?://[^\s<>'\"]+", value)
        value = match[0] if match else ""
    parsed = urllib.parse.urlsplit(value)
    return value[:2048] if parsed.scheme in ("http", "https") and parsed.netloc else None


def coords(item):
    try:
        lat, lon = Decimal(str(item.get("mapy", ""))), Decimal(str(item.get("mapx", "")))
        if not lat.is_finite() or not lon.is_finite():
            return None, None
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
            return None, None
        return lat.quantize(Decimal("0.0000001")), lon.quantize(Decimal("0.0000001"))
    except (InvalidOperation, ValueError):
        return None, None


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, Decimal)):
        return str(value)
    # Hex UTF-8 literals avoid quote/backslash ambiguity under any session SQL mode.
    value = str(value)
    return "CONVERT(X'" + value.encode("utf-8").hex() + "' USING utf8mb4) COLLATE utf8mb4_unicode_ci" if value else "''"


def upsert(table, columns, values, update_columns):
    statement = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(values)}) AS incoming\n"
    statement += "ON DUPLICATE KEY UPDATE " + ", ".join(f"{c} = incoming.{c}" for c in update_columns) + ";"
    return statement


def collect(api, region_codes, per_region, max_images):
    legal = api.all_codes("ldongCode2", lDongListYn="Y")
    classification = api.all_codes("lclsSystmCode2", lclsSystmListYn="Y")
    provinces = {str(row["lDongRegnCd"]): row["lDongRegnNm"] for row in legal}
    for code in region_codes:
        if code not in provinces:
            raise ImportFailure(f"Unknown legal province code: {code}")
    listings = []
    seen = set()
    for code in region_codes:
        accepted = 0
        page = 1
        while accepted < per_region:
            items, total = api.get("areaBasedList2", lDongRegnCd=code, contentTypeId="12",
                                   arrange="Q", numOfRows=per_region, pageNo=page)
            for item in items:
                content_id = str(item.get("contentid", ""))
                if content_id and content_id not in seen and item.get("title"):
                    if str(item.get("lDongRegnCd")) != code:
                        raise ImportFailure("API returned a place outside the requested province.")
                    listings.append(item)
                    seen.add(content_id)
                    accepted += 1
                    if accepted == per_region:
                        break
            if not items or page * per_region >= total:
                break
            page += 1
        if accepted != per_region:
            raise ImportFailure(f"Not enough places for province {code}: {accepted}/{per_region}")
        print(f"Fetched {accepted} attractions: {provinces[code]}", flush=True)

    def enrich(item):
        common, _ = api.get("detailCommon2", contentId=item["contentid"], numOfRows=1)
        intro, _ = api.get("detailIntro2", contentId=item["contentid"],
                            contentTypeId=item["contenttypeid"], numOfRows=1)
        images, _ = api.get("detailImage2", contentId=item["contentid"], imageYN="Y", numOfRows=max_images)
        if not common:
            raise ImportFailure(f"Missing common details for content ID {item['contentid']}")
        return {"listing": item, "common": common[0], "intro": intro[0] if intro else {}, "images": images,
                "fetched_at": api.common_timestamps[str(item["contentid"])]}

    with ThreadPoolExecutor(max_workers=4) as executor:
        records = list(executor.map(enrich, listings))
    print(f"Fetched details and images for {len(records)} places.", flush=True)
    return legal, classification, records


def generate_sql(legal, classifications, records, max_images, demo_members):
    fetched_at = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")
    lines = ["-- YUTOPIA: real TourAPI sample data (no API credentials).", f"-- Source: {SOURCE}",
             "-- Generated records are identified by provider=TOUR_API and external_id=contentid.",
             "-- Re-running this file updates the same places; it never drops a database.",
             "USE yutopia;", "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;", "START TRANSACTION;"]
    provinces = {str(row["lDongRegnCd"]): str(row["lDongRegnNm"]) for row in legal}
    districts = {(str(row["lDongRegnCd"]), str(row["lDongSignguCd"])): str(row["lDongSignguNm"])
                 for row in legal if row.get("lDongSignguCd")}
    categories = {}
    for row in classifications:
        for depth in (1, 2, 3):
            code = row.get(f"lclsSystm{depth}Cd")
            if code:
                categories[str(code)] = str(row[f"lclsSystm{depth}Nm"])
    region_vars = {}
    category_vars = {}
    region_places = {}
    image_count = tag_count = 0

    def ensure_region(code, name, parent, level):
        if code in region_vars:
            return region_vars[code]
        var = f"@seed_region_{len(region_vars) + 1}"
        values = [parent, literal(name), literal(code), str(level)]
        condition = f"region_code = {literal(code)} AND parent_id <=> {parent}"
        lines.extend([
            f"INSERT INTO regions (parent_id, region_name, region_code, region_level) SELECT {', '.join(values)} WHERE NOT EXISTS (SELECT 1 FROM regions WHERE {condition});",
            f"SET {var} = (SELECT MIN(region_id) FROM regions WHERE {condition});",
        ])
        region_vars[code] = var
        return var

    def ensure_category(code, name, parent):
        if code in category_vars:
            return category_vars[code]
        var = f"@seed_category_{len(category_vars) + 1}"
        condition = f"category_name = {literal(name)} AND parent_id <=> {parent}"
        lines.extend([
            f"INSERT INTO place_categories (parent_id, category_name) SELECT {parent}, {literal(name)} WHERE NOT EXISTS (SELECT 1 FROM place_categories WHERE {condition});",
            f"SET {var} = (SELECT MIN(category_id) FROM place_categories WHERE {condition});",
        ])
        category_vars[code] = var
        return var

    for number, record in enumerate(records, 1):
        item = dict(record["listing"])
        item.update({key: value for key, value in record["common"].items() if value not in (None, "")})
        intro = record["intro"]
        region_code = str(item["lDongRegnCd"])
        region_name = provinces[region_code]
        region_var = ensure_region("LDONG:" + region_code, region_name, "NULL", 1)
        district_code = str(item.get("lDongSignguCd", ""))
        district_name = districts.get((region_code, district_code))
        if district_code and not district_name:
            raise ImportFailure(f"Unknown district code {region_code}/{district_code}")
        if district_name:
            region_var = ensure_region(f"LDONG:{region_code}:{district_code}", district_name, region_var, 2)
        category_var = "NULL"
        category_tags = []
        for depth in (1, 2, 3):
            code = str(item.get(f"lclsSystm{depth}", ""))
            if not code:
                break
            if code not in categories:
                raise ImportFailure(f"Unknown classification code {code}")
            name = categories[code]
            category_var = ensure_category(code, name, category_var)
            category_tags.append(name)
        if category_var == "NULL":
            category_var = ensure_category("CONTENT_TYPE_12", CONTENT_TYPES["12"], "NULL")
        lat, lon = coords(item)
        place_var = f"@seed_place_{number}"
        content_id = str(item["contentid"])
        title = text(item["title"], 500)
        lines.append("-- Place: " + title.replace("\n", " ").replace("\r", " "))
        columns = ["category_id", "region_id", "provider", "external_id", "title", "address", "detail_address",
                   "zipcode", "latitude", "longitude", "place_url", "is_active"]
        values = [category_var, region_var, literal("TOUR_API"), literal(content_id), literal(title),
                  literal(text(item.get("addr1"), 500)), literal(text(item.get("addr2"), 255)),
                  literal(text(item.get("zipcode"), 10)), literal(lat), literal(lon),
                  "NULL", "1"]
        lines.append(upsert("places", columns, values, [c for c in columns if c not in ("provider", "external_id")]))
        lines.append(f"SET {place_var} = (SELECT place_id FROM places WHERE provider = 'TOUR_API' AND external_id = {literal(content_id)});")
        region_places.setdefault(region_code, []).append(place_var)
        pet = text(intro.get("chkpet"))
        pet_allowed = 1 if pet and pet.startswith("가능") else 0 if pet and pet.startswith("불가") else None
        intro_json = json.dumps({"source": SOURCE, "contentId": content_id, "contentTypeId": item["contenttypeid"],
                                 "intro": intro, "homepageOriginal": record["common"].get("homepage"),
                                 "classification": {f"level{d}": item.get(f"lclsSystm{d}") for d in (1, 2, 3)}}, ensure_ascii=False)
        detail_columns = ["place_id", "overview", "tel", "homepage_url", "opening_hours", "closed_days", "admission_fee",
                          "parking_info", "pet_allowed", "reservation_required", "`setting`", "intro_json", "fetched_at"]
        detail_values = [place_var, literal(text(item.get("overview"))), literal(text(item.get("tel") or intro.get("infocenter"), 100)),
                         literal(safe_url(item.get("homepage"))), literal(text(intro.get("usetime"))), literal(text(intro.get("restdate"))),
                         literal(text(intro.get("usefee"))), literal(text(intro.get("parking"))), literal(pet_allowed), "NULL",
                         literal("UNKNOWN"), literal(intro_json), literal(record["fetched_at"])]
        lines.append(upsert("place_details", detail_columns, detail_values, detail_columns[1:]))
        images = []
        representative = safe_url(item.get("firstimage"))
        if representative:
            images.append({"image_url": representative, "thumbnail_url": safe_url(item.get("firstimage2")),
                           "caption": title, "license_type": text(item.get("cpyrhtDivCd"), 30)})
        for image in record["images"]:
            url = safe_url(image.get("originimgurl"))
            if url and not any(existing["image_url"] == url for existing in images):
                images.append({"image_url": url, "thumbnail_url": safe_url(image.get("smallimageurl")),
                               "caption": text(image.get("imgname"), 255), "license_type": text(image.get("cpyrhtDivCd"), 30)})
        for order, image in enumerate(images[:max_images], 1):
            image_columns = ["place_id", "image_url", "thumbnail_url", "caption", "source", "license_type", "sort_order"]
            image_values = [place_var, literal(image["image_url"]), literal(image["thumbnail_url"]), literal(text(image["caption"], 255)),
                            literal("한국관광공사 TourAPI"), literal(image["license_type"]), str(order)]
            lines.append(upsert("place_images", image_columns, image_values, image_columns[1:-1]))
            image_count += 1
        tags = sorted({tag for tag in [region_name, district_name, CONTENT_TYPES.get(str(item["contenttypeid"])), *category_tags] if tag})
        for tag in tags:
            lines.append(f"INSERT INTO place_tags (place_id, tag) VALUES ({place_var}, {literal(tag[:50])}) ON DUPLICATE KEY UPDATE tag = tag;")
            tag_count += 1

    demo_count = favorite_count = 0
    if demo_members:
        for region_code, place_vars in region_places.items():
            name = provinces[region_code]
            email = f"tourapi-demo-{region_code}@example.invalid"
            # An unusable random hash marks fixture accounts; no shared/default login password.
            password_hash = "!sample-account-disabled:" + secrets.token_hex(32)
            lines.append(upsert("members", ["email", "nickname", "password_hash", "role"],
                                [literal(email), literal("[샘플] " + name), literal(password_hash), literal("USER")], ["email"]))
            member_var = f"@seed_member_{region_code}"
            lines.append(f"SET {member_var} = (SELECT member_id FROM members WHERE email = {literal(email)});")
            demo_count += 1
            for place_var in place_vars[:3]:
                lines.append(upsert("favorites", ["member_id", "place_id", "memo"],
                                    [member_var, place_var, literal("[샘플] 한국관광공사 관광정보로 만든 여행 찜")], ["member_id"]))
                favorite_count += 1
    lines.append("COMMIT;")
    summary = {"source": SOURCE, "generated_at_kst": fetched_at, "places": len(records), "regions": len(region_vars),
               "categories": len(category_vars), "details": len(records), "images": image_count, "tags": tag_count,
               "demo_members": demo_count, "demo_favorites": favorite_count,
               "provinces": {provinces[code]: len(places) for code, places in region_places.items()}}
    return "\n\n".join(lines) + "\n", summary


def resolve_environment(value):
    def replace(match):
        name, default = match.groups()
        if name in os.environ:
            return os.environ[name]
        if default is not None:
            return default
        raise ImportFailure(f"Set the required environment variable {name}.")
    return re.sub(r"\$\{([A-Za-z_]\w*)(?::([^}]*))?\}", replace, value)


def datasource_properties():
    properties = {}
    for name in ("application.properties", "application-local.properties"):
        path = ROOT / "src/main/resources" / name
        if path.exists():
            properties.update(re.findall(r"(?m)^\s*(spring\.datasource\.[^=\s]+)\s*=\s*(.*)$",
                                         path.read_text(encoding="utf-8")))
    for key, value in properties.items():
        environment_key = key.upper().replace(".", "_").replace("-", "_")
        properties[key] = resolve_environment(os.environ.get(environment_key, value))
    return properties


def mysql_connection():
    properties = datasource_properties()
    url = urllib.parse.urlsplit(properties["spring.datasource.url"].removeprefix("jdbc:"))
    if url.scheme != "mysql" or url.path != "/yutopia":
        raise ImportFailure("The application datasource must select the yutopia MySQL database.")
    executable = shutil.which("mysql")
    if not executable:
        raise ImportFailure("Install the MySQL command-line client and add mysql to PATH.")
    command = [executable, "--connect-timeout=10", "--default-character-set=utf8mb4", "--batch", "--skip-column-names",
               "--host=" + url.hostname, "--port=" + str(url.port or 3306), "--user=" + properties["spring.datasource.username"],
               "--database=yutopia"]
    env = os.environ.copy()
    env["MYSQL_PWD"] = properties["spring.datasource.password"]
    return command, env


def apply_sql(sql):
    command, env = mysql_connection()
    result = subprocess.run(command, input=sql.encode("utf-8"), env=env, capture_output=True)
    if result.returncode:
        # Do not print mysql's raw stderr: it can include connection identifiers.
        codes = re.findall(rb"ERROR\s+(\d+)", result.stderr)
        code = codes[0].decode() if codes else "unknown"
        raise ImportFailure(f"MySQL import failed (error {code}); no COMMIT was reached.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-region", type=int, default=10)
    parser.add_argument("--regions", nargs="+", default=["11", "26", "50"], help="Legal province codes: Seoul=11, Busan=26, Jeju=50")
    parser.add_argument("--max-images", type=int, default=3)
    parser.add_argument("--with-demo-members", action="store_true", help="Also create labeled, non-login sample members and favorites")
    parser.add_argument("--apply", action="store_true", help="Apply the generated SQL to the configured yutopia database")
    parser.add_argument("--apply-only", action="store_true", help="Apply existing seed SQL without calling TourAPI")
    parser.add_argument("--refresh", action="store_true", help="Refresh cached API responses")
    args = parser.parse_args()
    if not 1 <= args.per_region <= 100 or not 1 <= args.max_images <= 10:
        parser.error("Use 1..100 places per region and 1..10 images per place.")
    if args.apply_only:
        if not OUTPUT.exists():
            raise ImportFailure("Generate db/seed.sql first.")
        apply_sql(OUTPUT.read_text(encoding="utf-8"))
        print("Applied existing seed SQL to yutopia.")
        return
    api = TourApi(local_config(), args.refresh)
    legal, classifications, records = collect(api, list(dict.fromkeys(args.regions)), args.per_region, args.max_images)
    sql, summary = generate_sql(legal, classifications, records, args.max_images, args.with_demo_members)
    if api.key in sql:
        raise ImportFailure("Refusing to save an SQL file containing API credentials.")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(sql, encoding="utf-8")
    (OUTPUT.parent / "seed_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    print("Generated " + OUTPUT.relative_to(ROOT).as_posix(), flush=True)
    if args.apply:
        apply_sql(sql)
        print("Applied sample data to yutopia successfully.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (ImportFailure, KeyError, ValueError) as error:
        print("Import stopped: " + str(error), file=sys.stderr)
        sys.exit(1)
