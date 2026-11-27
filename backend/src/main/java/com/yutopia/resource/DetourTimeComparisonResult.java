package com.yutopia.resource;

import java.time.Instant;
import java.util.List;

import com.yutopia.resource.WalkingRouteRequest.Location;

public record DetourTimeComparisonResult(String source, String mode, Instant queriedAt, Location via,
        WalkingRouteResult originalRoute, WalkingRouteResult detourRoute,
        long distanceDifferenceMeters, long timeDifferenceSeconds, double timeDifferenceMinutes,
        Integer visitMinutes, Long totalSecondsIncludingVisit, Long extraSecondsIncludingVisit,
        List<String> notes) {
}
