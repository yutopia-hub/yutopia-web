"""Create only yutopia_test and its missing tables; never reset application data."""

import re
import subprocess
from seed_tourapi import ROOT, ImportFailure, mysql_connection


def main():
    command, env = mysql_connection()
    command = [argument for argument in command if not argument.startswith("--database=")]
    command = [argument for argument in command if not argument.startswith("--database=")]
    schema = (ROOT / "src/main/resources/db/schema.sql").read_text(encoding="utf-8")
    tables = re.findall(r"CREATE TABLE IF NOT EXISTS\s+\w+\s*\(.*?\) ENGINE=InnoDB[^;]+;", schema, re.S)
    if len(tables) != 8:
        raise ImportFailure("Expected exactly eight table definitions; no DDL executed.")
    # Deliberately do not execute DROP DATABASE or USE from the application reset script.
    sql = "CREATE DATABASE IF NOT EXISTS yutopia_test DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE yutopia_test;\n"
    sql += "\n".join(tables)
    sql += "\nSELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='yutopia_test' ORDER BY TABLE_NAME;"
    result = subprocess.run(command, input=sql.encode("utf-8"), env=env, capture_output=True)
    if result.returncode:
        raise ImportFailure("Could not prepare yutopia_test; connection details suppressed.")
    expected = {"members", "places", "regions", "place_categories", "place_details", "place_images", "place_tags", "favorites"}
    if set(result.stdout.decode("utf-8").split()) != expected:
        raise ImportFailure("Unexpected tables in yutopia_test. Inspect the dedicated test database before running tests.")
    print("Prepared dedicated MySQL database yutopia_test with eight tables. No application DB changes.")


if __name__ == "__main__":
    try:
        main()
    except ImportFailure as error:
        raise SystemExit(str(error))
