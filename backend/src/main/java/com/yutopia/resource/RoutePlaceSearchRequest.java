package com.yutopia.resource;

import java.util.List;

import com.yutopia.resource.WalkingRouteResult.Coordinate;

/** path must be the actual route returned by the walking route tool. */
public record RoutePlaceSearchRequest(List<Coordinate> path, Kind kind, Integer radiusMeters, Integer limit) {
    public enum Kind {
        RESTAURANT, POLICE, CAFE, CONVENIENCE_STORE, PHARMACY
    }
}
