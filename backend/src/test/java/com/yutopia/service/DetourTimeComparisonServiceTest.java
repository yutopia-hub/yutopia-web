package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.DetourTimeComparisonRequest;
import com.yutopia.resource.RoutePlaceSearchRequest;
import com.yutopia.resource.RoutePlaceSearchRequest.Kind;
import com.yutopia.resource.WalkingRouteRequest;
import com.yutopia.resource.WalkingRouteRequest.Location;
import com.yutopia.tool.DetourTimeComparisonTool;
import com.yutopia.tool.RoutePlaceSearchTool;
import com.yutopia.tool.WalkingRouteTool;

import tools.jackson.databind.json.JsonMapper;

/** HTTP mocks only; no live routes, database, server or LLM. */
class DetourTimeComparisonServiceTest {
    private final JsonMapper json = JsonMapper.builder().build();
    private final Location start = new Location("출발", 37.0, 127.0);
    private final Location end = new Location("도착", 37.0, 127.002);
    private final Location via = new Location("식당", 37.0005, 127.001);
    private MockRestServiceServer server;
    private WalkingRouteService walking;
    private DetourTimeComparisonService service;

    @BeforeEach
    void setup() {
        var builder = RestClient.builder().baseUrl("https://apis.openapi.sk.com");
        server = MockRestServiceServer.bindTo(builder).build();
        walking = new WalkingRouteService(builder.build(), json, "test-key");
        service = new DetourTimeComparisonService(walking);
    }

    @Test
    void comparesProviderRoutesUsingWaypointAndSameOptions() {
        server.expect(anything()).andExpect(content().json("{\"searchOption\":\"30\"}"))
                .andExpect(request -> assertFalse(json.readTree(requestBody(request)).has("passList")))
                .andRespond(withSuccess(route(1000, 600), MediaType.APPLICATION_JSON));
        server.expect(anything()).andExpect(header("appKey", "test-key"))
                .andExpect(content().json("""
                        {"startX":127.0,"startY":37.0,"endX":127.002,"endY":37.0,
                         "passList":"127.001,37.0005","searchOption":"30",
                         "reqCoordType":"WGS84GEO","resCoordType":"WGS84GEO"}
                        """))
                .andRespond(withSuccess(route(1250, 780), MediaType.APPLICATION_JSON));
        var result = new DetourTimeComparisonTool(service).compareDetourTime(
                new DetourTimeComparisonRequest(start, end, via, true, null));
        assertEquals(180, result.timeDifferenceSeconds());
        assertEquals(3, result.timeDifferenceMinutes());
        assertEquals(250, result.distanceDifferenceMeters());
        assertTrue(result.originalRoute().avoidStairsRequested());
        assertTrue(result.detourRoute().avoidStairsRequested());
        assertNull(result.visitMinutes());
        assertNull(result.totalSecondsIncludingVisit());
        assertNull(result.extraSecondsIncludingVisit());
        server.verify();
    }

    @Test
    void subtractsSecondsInsteadOfRoundedDisplayMinutes() {
        expectRoutes(1000, 600, 1001, 601);
        var result = service.compare(request(null));
        assertEquals(10, result.originalRoute().estimatedMinutes());
        assertEquals(11, result.detourRoute().estimatedMinutes());
        assertEquals(1, result.timeDifferenceSeconds());
        assertEquals(1.0 / 60, result.timeDifferenceMinutes(), 0.000001);
        server.verify();
    }

    @Test
    void explicitlyProvidedVisitTimeIsSeparateFromWalkingTime() {
        expectRoutes(1000, 600, 1250, 780);
        var result = service.compare(request(30));
        assertEquals(180, result.timeDifferenceSeconds());
        assertEquals(2580L, result.totalSecondsIncludingVisit());
        assertEquals(1980L, result.extraSecondsIncludingVisit());
        assertEquals(30, result.visitMinutes());
        server.verify();
    }

    @Test
    void explicitZeroVisitIsDistinctFromUnspecifiedVisit() {
        expectRoutes(1000, 600, 1250, 780);
        var result = service.compare(request(0));
        assertEquals(780L, result.totalSecondsIncludingVisit());
        assertEquals(180L, result.extraSecondsIncludingVisit());
        assertEquals(0, result.visitMinutes());
        server.verify();
    }

    @Test
    void preservesNegativeDifferencesWithoutInventingPositiveDelay() {
        expectRoutes(1000, 600, 900, 540);
        var result = service.compare(request(null));
        assertEquals(-60, result.timeDifferenceSeconds());
        assertEquals(-100, result.distanceDifferenceMeters());
        assertEquals(-1, result.timeDifferenceMinutes());
        assertTrue(result.notes().stream().anyMatch(n -> n.contains("더 짧게")));
        server.verify();
    }

    @Test
    void allInputsAreValidatedBeforeFirstProviderCall() {
        assertThrows(ApiException.class, () -> service.compare(null));
        for (Integer minutes : new Integer[] { -1, 1441 }) {
            assertEquals(HttpStatus.BAD_REQUEST,
                    assertThrows(ApiException.class, () -> service.compare(request(minutes))).getStatus());
        }
        for (Location bad : new Location[] { null, new Location("bad", Double.NaN, 127.0),
                new Location("bad", 37.0, null), new Location("bad", 91.0, 127.0) }) {
            assertThrows(ApiException.class, () -> service.compare(new DetourTimeComparisonRequest(start, end, bad, false, null)));
        }
        assertThrows(ApiException.class, () -> service.compare(new DetourTimeComparisonRequest(null, end, via, false, null)));
        assertThrows(ApiException.class, () -> service.compare(new DetourTimeComparisonRequest(start, null, via, false, null)));
        server.verify();
    }

    @Test
    void originalRouteFailureDoesNotRequestDetour() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED).body("secret test-key"));
        var error = assertThrows(ApiException.class, () -> service.compare(request(null)));
        assertFalse(error.getMessage().contains("test-key"));
        assertNull(error.getCause());
        server.verify();
    }

    @Test
    void detourFailureDoesNotReturnAFabricatedComparison() {
        server.expect(anything()).andRespond(withSuccess(route(1000, 600), MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withException(new java.net.SocketTimeoutException()));
        assertEquals(HttpStatus.GATEWAY_TIMEOUT,
                assertThrows(ApiException.class, () -> service.compare(request(null))).getStatus());
        server.verify();
    }

    @Test
    void equalEstimatesReturnZeroDifferences() {
        expectRoutes(1000, 600, 1000, 600);
        var result = service.compare(request(null));
        assertEquals(0, result.timeDifferenceSeconds());
        assertEquals(0, result.distanceDifferenceMeters());
        server.verify();
    }

    @Test
    void overflowDoesNotBecomeANegativeTotalVisitTime() {
        expectRoutes(1000, 600, 1250, Long.MAX_VALUE);
        assertEquals(HttpStatus.BAD_GATEWAY,
                assertThrows(ApiException.class, () -> service.compare(request(1))).getStatus());
        server.verify();
    }

    @Test
    void threeToolChainUsesPlaceSearchCoordinatesForDetour() {
        // Register all expectations before executing any provider request.
        server.expect(anything()).andRespond(withSuccess(route(178, 180), MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(route(178, 180), MediaType.APPLICATION_JSON));
        server.expect(anything()).andExpect(content().json("{\"passList\":\"127.001,37.0005\"}"))
                .andRespond(withSuccess(route(250, 240), MediaType.APPLICATION_JSON));
        var kakaoBuilder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        var kakao = MockRestServiceServer.bindTo(kakaoBuilder).build();
        for (int i = 0; i < 2; i++) kakao.expect(anything()).andRespond(withSuccess("""
                {"meta":{"is_end":true},"documents":[
                  {"id":"1","place_name":"식당","category_group_code":"FD6","category_name":"음식점",
                   "x":"127.001","y":"37.0005"}
                ]}
                """, MediaType.APPLICATION_JSON));
        var route = new WalkingRouteTool(walking).getWalkingRoute(new WalkingRouteRequest(start, end, false));
        var search = new RoutePlaceSearchTool(new RoutePlaceSearchService(kakaoBuilder.build(), json, "test-kakao-key"));
        var found = search.searchPlacesAlongRoute(new RoutePlaceSearchRequest(route.path(), Kind.RESTAURANT, 200, 5));
        var place = found.places().get(0);
        var comparison = new DetourTimeComparisonTool(service).compareDetourTime(
                new DetourTimeComparisonRequest(start, end, new Location(place.title(), place.lat(), place.lng()), false, null));
        assertEquals(60, comparison.timeDifferenceSeconds());
        assertEquals(place.lat(), comparison.via().lat());
        assertEquals(place.lng(), comparison.via().lng());
        server.verify();
        kakao.verify();
    }

    private DetourTimeComparisonRequest request(Integer minutes) {
        return new DetourTimeComparisonRequest(start, end, via, false, minutes);
    }

    private void expectRoutes(long originalMeters, long originalSeconds, long detourMeters, long detourSeconds) {
        server.expect(anything()).andRespond(withSuccess(route(originalMeters, originalSeconds), MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(route(detourMeters, detourSeconds), MediaType.APPLICATION_JSON));
    }

    private static String route(long distance, long seconds) {
        return """
                {"features":[
                  {"geometry":{"type":"Point","coordinates":[127,37]},
                   "properties":{"totalDistance":%d,"totalTime":%d}},
                  {"geometry":{"type":"LineString","coordinates":[[127,37],[127.002,37]]},"properties":{}}
                ]}
                """.formatted(distance, seconds);
    }

    private static String requestBody(org.springframework.http.client.ClientHttpRequest request) {
        return ((org.springframework.mock.http.client.MockClientHttpRequest) request).getBodyAsString();
    }
}
