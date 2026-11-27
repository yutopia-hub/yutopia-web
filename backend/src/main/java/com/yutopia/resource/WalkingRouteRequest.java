package com.yutopia.resource;

/** Coordinates must come from the selected course or a verified place lookup. */
public record WalkingRouteRequest(Location start, Location end, boolean avoidStairs) {
    public record Location(String name, Double lat, Double lng) {
    }
}
