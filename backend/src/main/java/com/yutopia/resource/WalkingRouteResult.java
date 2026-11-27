package com.yutopia.resource;

import java.time.Instant;
import java.util.List;

/** Provider estimates, not measured travel time or a complete accessibility audit. */
public record WalkingRouteResult(
        String source, String mode, Instant queriedAt,
        WalkingRouteRequest.Location start, WalkingRouteRequest.Location end,
        long distanceMeters, long estimatedSeconds, long estimatedMinutes,
        boolean avoidStairsRequested, List<Coordinate> path,
        List<Instruction> instructions, List<String> notes) {
    public record Coordinate(double lng, double lat) {
    }

    public record Instruction(String description, Integer turnType, Integer facilityType,
            String facilityName, Coordinate location) {
    }
}
