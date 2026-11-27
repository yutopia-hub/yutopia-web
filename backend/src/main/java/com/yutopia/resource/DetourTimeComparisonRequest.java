package com.yutopia.resource;

import com.yutopia.resource.WalkingRouteRequest.Location;

/** visitMinutes is optional and must be explicitly provided by the user, never inferred. */
public record DetourTimeComparisonRequest(Location start, Location end, Location via,
        boolean avoidStairs, Integer visitMinutes) {
}
