package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.ArrayList;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.RoutePlaceSearchRequest;
import com.yutopia.resource.RoutePlaceSearchRequest.Kind;
import com.yutopia.resource.WalkingRouteRequest;
import com.yutopia.resource.WalkingRouteRequest.Location;
import com.yutopia.resource.WalkingRouteResult.Coordinate;
import com.yutopia.tool.RoutePlaceSearchTool;
import com.yutopia.tool.WalkingRouteTool;

import tools.jackson.databind.json.JsonMapper;

/** All Kakao HTTP traffic is intercepted in memory. */
class RoutePlaceSearchServiceTest {
    private final List<Coordinate> path = List.of(new Coordinate(127, 37), new Coordinate(127.002, 37));
    private MockRestServiceServer server;
    private RestClient client;
    private RoutePlaceSearchService service;

    @BeforeEach
    void setup() {
        var builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = builder.build();
        service = new RoutePlaceSearchService(client, JsonMapper.builder().build(), "test-key");
    }

    @Test
    void walkingToolOutputFeedsPlaceSearchToolWithoutInventingPath() {
        var tmapBuilder = RestClient.builder().baseUrl("https://apis.openapi.sk.com");
        var tmap = MockRestServiceServer.bindTo(tmapBuilder).build();
        tmap.expect(requestTo("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1"))
                .andRespond(withSuccess("""
                        {"features":[
                          {"geometry":{"type":"Point","coordinates":[127,37]},
                           "properties":{"totalDistance":178,"totalTime":180}},
                          {"geometry":{"type":"LineString","coordinates":[[127,37],[127.002,37]]},"properties":{}}
                        ]}
                        """, MediaType.APPLICATION_JSON));
        var walking = new WalkingRouteTool(new WalkingRouteService(tmapBuilder.build(), JsonMapper.builder().build(), "test-tmap-key"));
        var route = walking.getWalkingRoute(new WalkingRouteRequest(
                new Location("출발", 37.0, 127.0), new Location("도착", 37.0, 127.002), false));
        expectSuccess(response(doc("1", "경로 식당", "FD6", "음식점", 127.001, 37), true), 2);
        var result = new RoutePlaceSearchTool(service).searchPlacesAlongRoute(
                new RoutePlaceSearchRequest(route.path(), Kind.RESTAURANT, 200, 5));
        assertEquals(1, result.places().size());
        assertEquals("kakao:1", result.places().get(0).id());
        assertEquals(0, result.places().get(0).distanceToRouteMeters());
        tmap.verify();
        server.verify();
    }

    @Test
    void filtersAgainstEntireRouteAndDeduplicatesProviderIds() {
        String docs = doc("1", "식당", "FD6", "음식점", 127.001, 37.00045) + ","
                + doc("2", "멀리 있는 식당", "FD6", "음식점", 127.001, 37.004) + ","
                + doc("3", "카페", "CE7", "카페", 127.001, 37);
        for (int i = 0; i < 2; i++) server.expect(request -> {
            assertEquals("/v2/local/search/category.json", request.getURI().getPath());
            String query = request.getURI().getQuery();
            assertTrue(query.contains("category_group_code=FD6"));
            assertTrue(query.contains("sort=distance"));
            assertTrue(query.contains("page=1"));
            assertTrue(query.contains("size=15"));
        }).andExpect(header("Authorization", "KakaoAK test-key"))
                .andRespond(withSuccess(response(docs, true), MediaType.APPLICATION_JSON));
        var result = new RoutePlaceSearchTool(service).searchPlacesAlongRoute(request(Kind.RESTAURANT));
        assertEquals(1, result.places().size());
        var place = result.places().get(0);
        assertEquals("kakao:1", place.id());
        assertEquals(50, place.distanceToRouteMeters(), 1);
        assertEquals(37, place.nearestRoutePoint().lat(), 0.000001);
        assertTrue(place.alongRouteMeters() > 0);
        assertEquals(2, result.requestsMade());
        assertFalse(result.partial());
        assertEquals("KAKAO", result.source());
        server.verify();
    }

    @Test
    void policeSearchUsesThreeKeywordsAndRejectsUnrelatedPublicInstitutions() {
        List<String> queries = new ArrayList<>();
        String docs = doc("4", "중앙지구대", "PO3", "공공기관 > 경찰서", 127.001, 37) + ","
                + doc("5", "시청", "PO3", "공공기관 > 시청", 127.001, 37);
        for (int i = 0; i < 6; i++) server.expect(request -> {
            assertEquals("/v2/local/search/keyword.json", request.getURI().getPath());
            queries.add(URLDecoder.decode(request.getURI().getRawQuery(), StandardCharsets.UTF_8));
        }).andRespond(withSuccess(response(docs, true), MediaType.APPLICATION_JSON));
        var result = service.search(request(Kind.POLICE));
        assertEquals(1, result.places().size());
        for (String keyword : List.of("경찰서", "지구대", "파출소")) {
            assertEquals(2, queries.stream().filter(q -> q.contains("query=" + keyword)).count());
        }
        server.verify();
    }

    @Test
    void resultLimitsAndProviderPaginationAreExplicit() {
        String docs = doc("1", "먼 식당", "FD6", "음식점", 127.001, 37.0005) + ","
                + doc("2", "가까운 식당", "FD6", "음식점", 127.001, 37.0001);
        expectSuccess(response(docs, false), 2);
        var result = service.search(new RoutePlaceSearchRequest(path, Kind.RESTAURANT, 200, 1));
        assertTrue(result.truncated());
        assertEquals("kakao:2", result.places().get(0).id());
        assertTrue(result.notes().stream().anyMatch(n -> n.contains("직선")));
        server.verify();
    }

    @Test
    void emptyResultsDoNotClaimFacilitiesDoNotExist() {
        expectSuccess(response("", true), 2);
        var result = service.search(request(Kind.CAFE));
        assertTrue(result.places().isEmpty());
        assertFalse(result.partial());
        assertTrue(result.notes().stream().anyMatch(n -> n.contains("단정할 수 없습니다")));
        server.verify();
    }

    @Test
    void partialFailuresRetainOnlySuccessfulPages() {
        String valid = doc("1", "식당", "FD6", "음식점", 127.001, 37);
        server.expect(anything()).andRespond(withSuccess(response(valid + ",{}", true), MediaType.APPLICATION_JSON));
        expectSuccess(response(doc("2", "다른 식당", "FD6", "음식점", 127.001, 37), true), 1);
        var result = service.search(request(Kind.RESTAURANT));
        assertTrue(result.partial());
        assertEquals(1, result.successfulRequests());
        assertEquals("kakao:2", result.places().get(0).id());
        assertEquals(1, result.places().size());
        server.verify();
    }

    @Test
    void rateLimitStopsFurtherCallsAndMarksSuccessfulSubset() {
        expectSuccess(response("", true), 1);
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        var result = service.search(request(Kind.POLICE));
        assertEquals(2, result.requestsMade());
        assertTrue(result.partial());
        server.verify();
    }

    @Test
    void authorizationFailureIsImmediateAndSanitized() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED).body("secret test-key"));
        var error = assertThrows(ApiException.class, () -> service.search(request(Kind.RESTAURANT)));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatus());
        assertFalse(error.getMessage().contains("secret"));
        assertFalse(error.getMessage().contains("test-key"));
        assertNull(error.getCause());
        server.verify();
    }

    @Test
    void completelyFailedSearchIsAnErrorRatherThanAnEmptySuccess() {
        for (int i = 0; i < 2; i++) server.expect(anything()).andRespond(withException(new java.net.SocketTimeoutException()));
        assertEquals(HttpStatus.GATEWAY_TIMEOUT,
                assertThrows(ApiException.class, () -> service.search(request(Kind.RESTAURANT))).getStatus());
        server.verify();
    }

    @Test
    void requestAndKeyValidationHappensBeforeAnyHttpCall() {
        assertThrows(ApiException.class, () -> service.search(null));
        assertThrows(ApiException.class, () -> service.search(new RoutePlaceSearchRequest(path, null, null, null)));
        assertThrows(ApiException.class, () -> service.search(new RoutePlaceSearchRequest(path, Kind.CAFE, 49, 5)));
        assertThrows(ApiException.class, () -> service.search(new RoutePlaceSearchRequest(path, Kind.CAFE, 200, 11)));
        assertThrows(ApiException.class, () -> service.search(new RoutePlaceSearchRequest(List.of(path.get(0)), Kind.CAFE, null, null)));
        var withoutKey = new RoutePlaceSearchService(client, JsonMapper.builder().build(), "");
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                assertThrows(ApiException.class, () -> withoutKey.search(request(Kind.CAFE))).getStatus());
        server.verify();
    }

    @Test
    void longRouteBoundsPoliceRequestsToTwelve() {
        var longPath = List.of(new Coordinate(127, 37), new Coordinate(127.2, 37));
        expectSuccess(response("", true), 12);
        var result = service.search(new RoutePlaceSearchRequest(longPath, Kind.POLICE, 200, 5));
        assertEquals(12, result.requestsMade());
        server.verify();
    }

    private RoutePlaceSearchRequest request(Kind kind) { return new RoutePlaceSearchRequest(path, kind, null, null); }

    private void expectSuccess(String body, int count) {
        for (int i = 0; i < count; i++) server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    private static String response(String documents, boolean end) {
        return "{\"meta\":{\"is_end\":" + end + "},\"documents\":[" + documents + "]}";
    }

    private static String doc(String id, String name, String group, String category, double lng, double lat) {
        return """
                {"id":"%s","place_name":"%s","category_group_code":"%s","category_name":"%s",
                 "x":"%s","y":"%s","road_address_name":"도로명주소","phone":"02-000-0000",
                 "place_url":"https://place.map.kakao.com/%s"}
                """.formatted(id, name, group, category, lng, lat, id);
    }
}
