package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.WalkingRouteRequest;
import com.yutopia.resource.WalkingRouteRequest.Location;
import com.yutopia.tool.WalkingRouteTool;

import tools.jackson.databind.json.JsonMapper;

/** In-memory HTTP mocks only: no Spring server, database, credentials or network. */
class WalkingRouteServiceTest {
    private MockRestServiceServer server;
    private RestClient client;
    private WalkingRouteService service;
    private final JsonMapper json = JsonMapper.builder().build();
    private final WalkingRouteRequest request = new WalkingRouteRequest(
            new Location("출발", 37.57, 126.98), new Location("도착", 37.58, 126.99), false);

    private static final String RESPONSE = """
            {"type":"FeatureCollection","features":[
              {"geometry":{"type":"Point","coordinates":[126.98,37.57]},
               "properties":{"totalDistance":1234,"totalTime":901,"turnType":200,"description":"출발"}},
              {"geometry":{"type":"LineString","coordinates":[[126.98,37.57],[126.985,37.575]]},
               "properties":{"facilityType":"12","facilityName":"육교","description":"육교로 이동"}},
              {"geometry":{"type":"Point","coordinates":[126.985,37.575]},
               "properties":{"turnType":125,"description":"육교 진입"}},
              {"geometry":{"type":"LineString","coordinates":[[126.985,37.575],[126.99,37.58]]},
               "properties":{"facilityType":17,"description":"계단 이동"}}
            ]}
            """;

    @BeforeEach
    void setup() {
        var builder = RestClient.builder().baseUrl("https://apis.openapi.sk.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = builder.build();
        service = new WalkingRouteService(client, json, "test-key");
    }

    @Test
    void toolSendsCoordinatesAndPreservesProviderEvidence() {
        server.expect(requestTo("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1"))
                .andExpect(method(HttpMethod.POST)).andExpect(header("appKey", "test-key"))
                .andExpect(content().json("""
                        {"startX":126.98,"startY":37.57,"endX":126.99,"endY":37.58,
                         "startName":"%EC%B6%9C%EB%B0%9C","endName":"%EB%8F%84%EC%B0%A9",
                         "reqCoordType":"WGS84GEO","resCoordType":"WGS84GEO","searchOption":"0"}
                        """))
                .andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON));
        var result = new WalkingRouteTool(service).getWalkingRoute(request);
        assertEquals("TMAP", result.source());
        assertEquals("walk", result.mode());
        assertEquals(1234, result.distanceMeters());
        assertEquals(901, result.estimatedSeconds());
        assertEquals(16, result.estimatedMinutes());
        assertEquals(3, result.path().size());
        assertEquals(126.98, result.path().get(0).lng());
        assertTrue(result.instructions().stream().anyMatch(i -> Integer.valueOf(125).equals(i.turnType())));
        assertTrue(result.instructions().stream().anyMatch(i -> Integer.valueOf(12).equals(i.facilityType())));
        assertTrue(result.instructions().stream().anyMatch(i -> Integer.valueOf(17).equals(i.facilityType())));
        assertFalse(result.notes().isEmpty());
        server.verify();
    }

    @Test
    void stairAvoidanceUsesProviderOptionAndRemainsAnEstimate() {
        server.expect(requestTo("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1"))
                .andExpect(content().json("{\"searchOption\":\"30\"}"))
                .andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON));
        var result = service.findRoute(new WalkingRouteRequest(request.start(), request.end(), true));
        assertTrue(result.avoidStairsRequested());
        assertTrue(result.notes().stream().anyMatch(n -> n.contains("보장하지 않습니다")));
        server.verify();
    }

    @Test
    void invalidCoordinatesNeverCallProvider() {
        for (Double latitude : new Double[] { null, Double.NaN, Double.POSITIVE_INFINITY, 91.0 }) {
            var bad = new WalkingRouteRequest(new Location("bad", latitude, 127.0), request.end(), false);
            assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ApiException.class, () -> service.findRoute(bad)).getStatus());
        }
        assertThrows(ApiException.class, () -> service.findRoute(null));
        assertThrows(ApiException.class, () -> service.findRoute(new WalkingRouteRequest(null, request.end(), false)));
        server.verify();
    }

    @Test
    void missingKeyDoesNotCallProvider() {
        var withoutKey = new WalkingRouteService(client, json, " ");
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                assertThrows(ApiException.class, () -> withoutKey.findRoute(request)).getStatus());
        server.verify();
    }

    @Test
    void authorizationErrorDoesNotExposeProviderBodyOrKey() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .body("secret-provider-body test-key"));
        var error = assertThrows(ApiException.class, () -> service.findRoute(request));
        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatus());
        assertFalse(error.getMessage().contains("test-key"));
        assertFalse(error.getMessage().contains("secret-provider-body"));
        assertNull(error.getCause());
        server.verify();
    }

    @Test
    void rateLimitIsReportedWithoutRetry() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        assertTrue(assertThrows(ApiException.class, () -> service.findRoute(request)).getMessage().contains("한도"));
        server.verify();
    }

    @Test
    void connectionFailureIsNotTurnedIntoFabricatedRoute() {
        server.expect(anything()).andRespond(withException(new java.net.SocketTimeoutException("timeout")));
        assertEquals(HttpStatus.GATEWAY_TIMEOUT,
                assertThrows(ApiException.class, () -> service.findRoute(request)).getStatus());
        server.verify();
    }

    @Test
    void missingTotalsAndBrokenResponsesDoNotBecomeZeroMinuteRoutes() {
        String[] invalid = { "", "null", "{", "{\"features\":[]}",
                RESPONSE.replace("\"totalTime\":901", "\"other\":901"),
                RESPONSE.replace("\"totalDistance\":1234", "\"totalDistance\":-1"),
                RESPONSE.replace("\"totalTime\":901", "\"totalTime\":1.5"),
                RESPONSE.replace("126.985", "999.0"),
                "{\"features\":[{\"properties\":{\"totalDistance\":10,\"totalTime\":30}}]}" };
        for (String body : invalid) {
            server.reset();
            server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
            assertEquals(HttpStatus.BAD_GATEWAY,
                    assertThrows(ApiException.class, () -> service.findRoute(request), body).getStatus());
            server.verify();
        }
    }
}
