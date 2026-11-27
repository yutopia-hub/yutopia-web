package com.yutopia.resource;

import java.time.Instant;
import java.util.List;

import com.yutopia.resource.WalkingRouteResult.Coordinate;

public record RoutePlaceSearchResult(String source, Instant queriedAt, RoutePlaceSearchRequest.Kind kind,
        int radiusMeters, double routeLengthMeters, int requestsMade, int successfulRequests,
        boolean partial, boolean truncated, List<Place> places, List<String> notes) {
    public record Place(String id, String title, String category, String address, String phone,
            String placeUrl, double lat, double lng, double distanceToRouteMeters,
            double alongRouteMeters, Coordinate nearestRoutePoint) {
    }
}
