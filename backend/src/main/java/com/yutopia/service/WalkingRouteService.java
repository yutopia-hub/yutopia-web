package com.yutopia.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.WalkingRouteRequest;
import com.yutopia.resource.WalkingRouteRequest.Location;
import com.yutopia.resource.WalkingRouteResult;
import com.yutopia.resource.WalkingRouteResult.Coordinate;
import com.yutopia.resource.WalkingRouteResult.Instruction;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class WalkingRouteService {
    private final RestClient client;
    private final JsonMapper json;
    private final String apiKey;

    public WalkingRouteService(@Qualifier("tmapRestClient") RestClient client, JsonMapper json,
            @Value("${yutopia.tmap.api-key:}") String apiKey) {
        this.client = client;
        this.json = json;
        this.apiKey = apiKey.trim();
    }

    public WalkingRouteResult findRoute(WalkingRouteRequest request) {
        return findRoute(request, null);
    }

    /** Single provider route through one confirmed waypoint, using the same routing options. */
    public WalkingRouteResult findRouteVia(WalkingRouteRequest request, Location via) {
        validateLocation(via);
        return findRoute(request, via);
    }

    private WalkingRouteResult findRoute(WalkingRouteRequest request, Location via) {
        if (request == null) throw ApiException.badRequest("출발지와 도착지가 필요합니다.");
        validateLocation(request.start());
        validateLocation(request.end());
        if (apiKey.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "TMAP API 키가 설정되지 않았습니다.");
        }
        Map<String, Object> body = new LinkedHashMap<>(Map.of(
                "startX", request.start().lng(), "startY", request.start().lat(),
                "endX", request.end().lng(), "endY", request.end().lat(),
                "startName", encodedName(request.start().name(), "출발지"),
                "endName", encodedName(request.end().name(), "도착지"),
                "reqCoordType", "WGS84GEO", "resCoordType", "WGS84GEO",
                "searchOption", request.avoidStairs() ? "30" : "0"));
        if (via != null) body.put("passList", via.lng() + "," + via.lat());
        try {
            String response = client.post().uri("/tmap/routes/pedestrian?version=1")
                    .header("appKey", apiKey).contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
            return parse(response, request);
        } catch (RestClientResponseException e) {
            // Never propagate provider bodies, headers, or credentials to the model/user.
            String message = switch (e.getStatusCode().value()) {
                case 401, 403 -> "TMAP 인증 또는 보행자 경로 API 사용 권한을 확인해 주세요.";
                case 429 -> "TMAP 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
                default -> "TMAP 보행 경로를 조회하지 못했습니다.";
            };
            throw new ApiException(HttpStatus.BAD_GATEWAY, message);
        } catch (ResourceAccessException e) {
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "TMAP 연결에 실패했거나 응답 시간이 초과되었습니다.");
        } catch (RestClientException | JacksonException e) {
            throw invalidResponse();
        }
    }

    private WalkingRouteResult parse(String response, WalkingRouteRequest request) {
        if (response == null || response.isBlank()) throw invalidResponse();
        JsonNode root = json.readTree(response);
        if (root == null) throw invalidResponse();
        JsonNode features = root.path("features");
        if (!features.isArray() || features.isEmpty()) throw invalidResponse();
        JsonNode totals = features.get(0).path("properties");
        long distance = nonNegativeLong(totals.path("totalDistance"));
        long seconds = nonNegativeLong(totals.path("totalTime"));
        List<Coordinate> path = new ArrayList<>();
        List<Instruction> instructions = new ArrayList<>();
        for (JsonNode feature : features) {
            JsonNode geometry = feature.path("geometry");
            JsonNode properties = feature.path("properties");
            String type = geometry.path("type").asString("");
            Coordinate location = null;
            if ("LineString".equals(type)) {
                JsonNode coordinates = geometry.path("coordinates");
                if (!coordinates.isArray()) throw invalidResponse();
                for (JsonNode pair : coordinates) {
                    Coordinate point = coordinate(pair);
                    if (path.isEmpty() || !path.get(path.size() - 1).equals(point)) path.add(point);
                }
            } else if ("Point".equals(type)) {
                location = coordinate(geometry.path("coordinates"));
            }
            String description = properties.path("description").asString("");
            Integer turnType = integer(properties.path("turnType"));
            Integer facilityType = integer(properties.path("facilityType"));
            if (!description.isBlank() || turnType != null || facilityType != null) {
                instructions.add(new Instruction(description, turnType, facilityType,
                        properties.path("facilityName").asString(""), location));
            }
        }
        if (path.size() < 2) throw invalidResponse();
        return new WalkingRouteResult("TMAP", "walk", Instant.now(), request.start(), request.end(),
                distance, seconds, seconds / 60 + (seconds % 60 == 0 ? 0 : 1), request.avoidStairs(),
                List.copyOf(path), List.copyOf(instructions), List.of(
                        "이동 시간은 TMAP의 예상값이며 대기·식사·관람 시간은 포함하지 않습니다.",
                        "안내에 시설 정보가 없더라도 육교·계단이 없다고 단정할 수 없습니다. 계단 제외 옵션도 무장애 이동을 보장하지 않습니다."));
    }

    static void validateLocation(Location place) {
        if (place == null || place.lat() == null || place.lng() == null
                || !Double.isFinite(place.lat()) || !Double.isFinite(place.lng())
                || place.lat() < -90 || place.lat() > 90 || place.lng() < -180 || place.lng() > 180) {
            throw ApiException.badRequest("유효한 출발지와 도착지 좌표가 필요합니다.");
        }
        if (place.name() != null && place.name().length() > 100) {
            throw ApiException.badRequest("장소 이름은 100자 이내로 입력해 주세요.");
        }
    }

    private static String encodedName(String name, String fallback) {
        return URLEncoder.encode(name == null || name.isBlank() ? fallback : name.trim(), StandardCharsets.UTF_8);
    }

    private static long nonNegativeLong(JsonNode node) {
        if (!node.isIntegralNumber() || !node.canConvertToLong() || node.longValue() < 0) throw invalidResponse();
        return node.longValue();
    }

    private static Coordinate coordinate(JsonNode pair) {
        if (!pair.isArray() || pair.size() < 2 || !pair.get(0).isNumber() || !pair.get(1).isNumber()) {
            throw invalidResponse();
        }
        double lng = pair.get(0).doubleValue(), lat = pair.get(1).doubleValue();
        if (!Double.isFinite(lng) || !Double.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
            throw invalidResponse();
        }
        return new Coordinate(lng, lat);
    }

    private static Integer integer(JsonNode node) {
        if (node.isIntegralNumber() && node.canConvertToInt()) return node.intValue();
        // Some TMAP facility codes are returned as strings.
        if (node.isTextual()) {
            try { return Integer.valueOf(node.asString()); }
            catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static ApiException invalidResponse() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "TMAP에서 유효한 보행 경로 정보를 받지 못했습니다.");
    }
}
