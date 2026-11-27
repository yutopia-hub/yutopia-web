package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.WalkingRouteResult.Coordinate;

class RouteGeometryTest {
    @Test
    void measuresDistanceToSegmentsRatherThanOnlyVertices() {
        var geometry = new RouteGeometry(List.of(new Coordinate(127, 37), new Coordinate(127.02, 37)));
        var projection = geometry.project(new Coordinate(127.01, 37.00045));
        assertEquals(50, projection.distance(), 1);
        assertEquals(geometry.length() / 2, projection.along(), 0.1);
    }

    @Test
    void followsBentRouteInsteadOfConnectingEndpoints() {
        var geometry = new RouteGeometry(List.of(new Coordinate(127, 37), new Coordinate(127.01, 37), new Coordinate(127.01, 37.01)));
        assertTrue(geometry.project(new Coordinate(127.005, 37.005)).distance() > 400);
        assertEquals(0, geometry.project(new Coordinate(127.01, 37.005)).distance(), 0.01);
    }

    @Test
    void anchorsIncludeRouteEndsAndHandleRepeatedCoordinates() {
        var start = new Coordinate(127, 37);
        var end = new Coordinate(127.02, 37);
        var geometry = new RouteGeometry(List.of(start, start, end));
        var anchors = geometry.anchors(200);
        assertEquals(4, anchors.size());
        assertEquals(start.lng(), anchors.get(0).lng(), 0.000001);
        assertEquals(end.lng(), anchors.get(3).lng(), 0.000001);
        assertEquals(0, geometry.project(start).distance());
    }

    @Test
    void rejectsDegenerateNonfiniteAndExcessivePaths() {
        assertThrows(ApiException.class, () -> new RouteGeometry(List.of(new Coordinate(127, 37), new Coordinate(127, 37))));
        assertThrows(ApiException.class, () -> new RouteGeometry(List.of(new Coordinate(Double.NaN, 37), new Coordinate(127, 37))));
        assertThrows(ApiException.class, () -> new RouteGeometry(List.of(new Coordinate(127, 37), new Coordinate(129, 37))));
    }
}
