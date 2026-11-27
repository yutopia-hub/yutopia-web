package com.yutopia.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.RoutePlaceSearchRequest;
import com.yutopia.resource.RoutePlaceSearchRequest.Kind;
import com.yutopia.resource.RoutePlaceSearchResult;
import com.yutopia.resource.RoutePlaceSearchResult.Place;
import com.yutopia.resource.WalkingRouteResult.Coordinate;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class RoutePlaceSearchService {
    private final RestClient client;
    private final JsonMapper json;
    private final String apiKey;

    public RoutePlaceSearchService(@Qualifier("kakaoLocalRestClient") RestClient client, JsonMapper json,
            @Value("${yutopia.kakao.rest-api-key:}") String apiKey) {
        this.client = client;
        this.json = json;
        this.apiKey = apiKey.trim();
    }

    public RoutePlaceSearchResult search(RoutePlaceSearchRequest request) {
        if (request == null || request.kind() == null) throw ApiException.badRequest("검색할 장소 종류가 필요합니다.");
        int radius = request.radiusMeters() == null ? 200 : request.radiusMeters();
        int limit = request.limit() == null ? 5 : request.limit();
        if (radius < 50 || radius > 1000 || limit < 1 || limit > 10) {
            throw ApiException.badRequest("경로 주변 반경은 50~1000m, 결과 수는 1~10개로 지정해 주세요.");
        }
        var geometry = new RouteGeometry(request.path());
        if (apiKey.isBlank()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "카카오 REST API 키가 설정되지 않았습니다.");
        List<Coordinate> anchors = geometry.anchors(radius);
        // Enlarged query circles cover the corridor between anchors. Final filtering uses the polyline.
        int queryRadius = (int) Math.ceil(radius + geometry.length() / (anchors.size() - 1) / 2);
        List<String> queries = request.kind() == Kind.POLICE ? List.of("경찰서", "지구대", "파출소") : List.of("");
        Map<String, Place> places = new LinkedHashMap<>();
        int attempts = 0, successes = 0;
        boolean truncated = false, stop = false;
        ApiException lastFailure = null;
        for (Coordinate anchor : anchors) {
            for (String query : queries) {
                attempts++;
                try {
                    JsonNode root = fetch(anchor, queryRadius, request.kind(), query);
                    // Only the first provider page is requested: never claim an exhaustive search.
                    truncated |= !root.path("meta").path("is_end").booleanValue();
                    // Commit a page only after all of its records have been validated.
                    Map<String, Place> page = new LinkedHashMap<>();
                    try {
                        for (JsonNode document : root.path("documents")) {
                            Place place = place(document, request.kind(), geometry, radius);
                            if (place != null) page.putIfAbsent(place.id(), place);
                        }
                    } catch (JacksonException e) { throw invalidResponse(); }
                    page.forEach(places::putIfAbsent);
                    successes++;
                } catch (ApiException e) {
                    if (e.getStatus() == HttpStatus.SERVICE_UNAVAILABLE) throw e;
                    lastFailure = e;
                    if (e.getStatus() == HttpStatus.TOO_MANY_REQUESTS) { stop = true; break; }
                }
            }
            if (stop) break;
        }
        if (successes == 0) throw lastFailure;
        var sorted = places.values().stream().sorted(Comparator.comparingDouble(Place::distanceToRouteMeters)
                .thenComparingDouble(Place::alongRouteMeters).thenComparing(Place::id)).toList();
        truncated |= sorted.size() > limit;
        boolean partial = successes < attempts || stop;
        List<String> notes = new ArrayList<>(List.of(
                "경로와 장소 사이의 거리는 좌표로 계산한 대략적인 직선 이격 거리이며 실제 도보 거리·시간이 아닙니다.",
                "최대 4개 지점에서 검색하며 각 요청의 첫 15개 결과를 사용합니다. 검색 결과가 비어도 주변 시설이 없다고 단정할 수 없습니다.",
                "영업 여부·실시간 이용 가능 여부·보행 접근성은 이 검색에서 확인하지 않습니다."));
        if (partial) notes.add("일부 검색 요청이 실패하거나 한도에 도달해 조회에 성공한 결과만 제공합니다.");
        if (truncated) notes.add("검색 페이지 또는 표시 개수 제한으로 일부 후보가 포함되지 않았습니다.");
        return new RoutePlaceSearchResult("KAKAO", Instant.now(), request.kind(), radius, round(geometry.length()),
                attempts, successes, partial, truncated, List.copyOf(sorted.subList(0, Math.min(limit, sorted.size()))),
                List.copyOf(notes));
    }

    private JsonNode fetch(Coordinate anchor, int radius, Kind kind, String query) {
        try {
            String body = client.get().uri(builder -> {
                builder.path(kind == Kind.POLICE ? "/v2/local/search/keyword.json" : "/v2/local/search/category.json")
                        .queryParam("x", anchor.lng()).queryParam("y", anchor.lat())
                        .queryParam("radius", radius).queryParam("sort", "distance").queryParam("size", 15).queryParam("page", 1);
                if (kind == Kind.POLICE) builder.queryParam("query", "{keyword}");
                else builder.queryParam("category_group_code", categoryCode(kind));
                return kind == Kind.POLICE ? builder.build(Map.of("keyword", query)) : builder.build();
            }).header("Authorization", "KakaoAK " + apiKey).retrieve().body(String.class);
            if (body == null || body.isBlank()) throw invalidResponse();
            JsonNode root = json.readTree(body);
            if (root == null || !root.path("documents").isArray() || !root.path("meta").path("is_end").isBoolean()) {
                throw invalidResponse();
            }
            return root;
        } catch (RestClientResponseException e) {
            throw switch (e.getStatusCode().value()) {
                case 401, 403 -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "카카오 REST 키 또는 로컬 API 사용 권한을 확인해 주세요.");
                case 429 -> new ApiException(HttpStatus.TOO_MANY_REQUESTS, "카카오 장소 검색 한도를 초과했습니다.");
                default -> new ApiException(HttpStatus.BAD_GATEWAY, "카카오 장소 검색에 실패했습니다.");
            };
        } catch (ResourceAccessException e) {
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "카카오 장소 검색 연결에 실패했거나 시간이 초과되었습니다.");
        } catch (RestClientException | JacksonException e) {
            throw invalidResponse();
        }
    }

    private static Place place(JsonNode doc, Kind kind, RouteGeometry geometry, int radius) {
        String id = doc.path("id").asString(""), title = doc.path("place_name").asString("");
        String category = doc.path("category_name").asString("");
        if (id.isBlank() || title.isBlank()) throw invalidResponse();
        if (kind == Kind.POLICE) {
            if (!category.contains("경찰") && !title.endsWith("경찰서") && !title.endsWith("지구대") && !title.endsWith("파출소")) return null;
        } else if (!categoryCode(kind).equals(doc.path("category_group_code").asString(""))) return null;
        double lng, lat;
        try {
            lng = Double.parseDouble(doc.path("x").asString(""));
            lat = Double.parseDouble(doc.path("y").asString(""));
        } catch (NumberFormatException e) { throw invalidResponse(); }
        if (!Double.isFinite(lng) || !Double.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 85) throw invalidResponse();
        var projection = geometry.project(new Coordinate(lng, lat));
        if (projection.distance() > radius) return null;
        String address = doc.path("road_address_name").asString("");
        if (address.isBlank()) address = doc.path("address_name").asString("");
        String url = doc.path("place_url").asString("");
        if (!url.startsWith("https://place.map.kakao.com/") && !url.startsWith("http://place.map.kakao.com/")) url = "";
        return new Place("kakao:" + id, title, category, address, doc.path("phone").asString(""), url,
                lat, lng, round(projection.distance()), round(projection.along()), projection.nearest());
    }

    private static String categoryCode(Kind kind) {
        return switch (kind) {
            case RESTAURANT -> "FD6";
            case CAFE -> "CE7";
            case CONVENIENCE_STORE -> "CS2";
            case PHARMACY -> "PM9";
            case POLICE -> throw new IllegalArgumentException("Police uses keyword search");
        };
    }

    private static double round(double value) { return Math.round(value * 10) / 10.0; }
    private static ApiException invalidResponse() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "카카오에서 유효한 장소 검색 결과를 받지 못했습니다.");
    }
}
