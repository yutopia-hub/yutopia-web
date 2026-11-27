package com.yutopia.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.DetourTimeComparisonRequest;
import com.yutopia.resource.RoutePlaceSearchRequest;
import com.yutopia.resource.RoutePlaceSearchRequest.Kind;
import com.yutopia.resource.RoutePlaceSearchResult;
import com.yutopia.resource.WalkingRouteRequest;
import com.yutopia.resource.WalkingRouteResult;
import com.yutopia.resource.YutoCourse;
import com.yutopia.tool.DetourTimeComparisonTool;
import com.yutopia.tool.RoutePlaceSearchTool;
import com.yutopia.tool.WalkingRouteTool;

/** One instance per turn. The model supplies IDs; coordinates and paths stay server-controlled. */
public final class YutoCourseTools {
    private static final Duration CANDIDATE_TTL = Duration.ofMinutes(10);
    private final YutoCourse course;
    private final WalkingRouteTool walking;
    private final RoutePlaceSearchTool search;
    private final DetourTimeComparisonTool detour;
    private final Map<RouteKey, WalkingRouteResult> routes = new HashMap<>();
    private final Map<String, RoutePlaceSearchResult> searches = new HashMap<>();
    private final LinkedHashMap<String, Candidate> candidates;
    private int operations, searchOperations, detourOperations;

    public YutoCourseTools(YutoCourse course, LinkedHashMap<String, Candidate> candidates,
            WalkingRouteTool walking, RoutePlaceSearchTool search, DetourTimeComparisonTool detour) {
        this.course = course; this.candidates = new LinkedHashMap<>(candidates);
        this.walking = walking; this.search = search; this.detour = detour;
        this.candidates.values().removeIf(c -> !c.queriedAt().plus(CANDIDATE_TTL).isAfter(Instant.now()));
    }

    @Tool(description = "현재 코스의 두 장소 ID 사이 보행 시간·거리와 제공된 육교·계단 안내를 조회합니다. 코스에 있는 ID만 사용하세요.")
    public Map<String, Object> getWalkingRoute(String startStopId, String endStopId, boolean avoidStairs) {
        return routeSummary(route(new RouteKey(startStopId, endStopId, avoidStairs)));
    }

    @Tool(description = "현재 코스의 보행 구간 주변 장소를 검색합니다. 서버가 먼저 실제 보행 경로를 확보한 뒤 검색합니다. 반환된 장소 ID는 경유 비교에 사용할 수 있습니다.")
    public RoutePlaceSearchResult searchPlacesAlongRoute(String startStopId, String endStopId, boolean avoidStairs,
            Kind kind, @ToolParam(required = false) Integer radiusMeters, @ToolParam(required = false) Integer limit) {
        if (kind == null || (radiusMeters != null && (radiusMeters < 50 || radiusMeters > 1000))
                || (limit != null && (limit < 1 || limit > 10))) throw ApiException.badRequest("검색 종류·반경·결과 수를 확인해 주세요.");
        var key = new RouteKey(startStopId, endStopId, avoidStairs);
        validate(key);
        String searchKey = key + ":" + kind + ":" + radiusMeters + ":" + limit;
        if (searches.containsKey(searchKey)) return searches.get(searchKey);
        if (++searchOperations > 2) throw ApiException.badRequest("한 질문에서는 주변 장소를 두 종류까지 검색할 수 있습니다.");
        var route = route(key);
        consume();
        var result = search.searchPlacesAlongRoute(new RoutePlaceSearchRequest(route.path(), kind, radiusMeters, limit));
        searches.put(searchKey, result);
        for (var place : result.places()) candidates.put(key + ":" + place.id(), new Candidate(key, place, result.queriedAt()));
        while (candidates.size() > 40) candidates.remove(candidates.keySet().iterator().next());
        return result;
    }

    @Tool(description = "같은 보행 구간에서 앞서 검색된 장소 ID 한 곳을 경유할 때 추가 이동 시간을 비교합니다. 미검색 장소는 먼저 검색하세요. 체류 시간은 사용자가 명시한 경우만 지정하세요.")
    public Map<String, Object> compareDetourTime(String startStopId, String endStopId, String placeId, boolean avoidStairs,
            @ToolParam(required = false) Integer visitMinutes) {
        var key = new RouteKey(startStopId, endStopId, avoidStairs);
        validate(key);
        var candidate = candidates.get(key + ":" + placeId);
        if (candidate == null || !candidate.queriedAt().plus(CANDIDATE_TTL).isAfter(Instant.now())) {
            throw ApiException.badRequest("이 구간에서 최근 검색한 장소를 선택해 주세요. 검색 결과가 없거나 오래되었다면 먼저 다시 검색해야 합니다.");
        }
        if (visitMinutes != null && (visitMinutes < 0 || visitMinutes > 1440)) throw ApiException.badRequest("체류 시간은 0~1440분이어야 합니다.");
        if (++detourOperations > 1) throw ApiException.badRequest("한 질문에서는 한 장소의 경유 시간을 비교할 수 있습니다.");
        consume();
        var p = candidate.place();
        var result = detour.compareDetourTime(new DetourTimeComparisonRequest(stop(startStopId).location(), stop(endStopId).location(),
                new WalkingRouteRequest.Location(p.title(), p.lat(), p.lng()), avoidStairs, visitMinutes));
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("placeId", p.id()); summary.put("placeTitle", p.title());
        summary.put("source", result.source()); summary.put("queriedAt", result.queriedAt());
        summary.put("originalEstimatedSeconds", result.originalRoute().estimatedSeconds());
        summary.put("detourEstimatedSeconds", result.detourRoute().estimatedSeconds());
        summary.put("timeDifferenceSeconds", result.timeDifferenceSeconds());
        summary.put("distanceDifferenceMeters", result.distanceDifferenceMeters());
        summary.put("visitMinutes", result.visitMinutes()); summary.put("totalSecondsIncludingVisit", result.totalSecondsIncludingVisit());
        summary.put("extraSecondsIncludingVisit", result.extraSecondsIncludingVisit()); summary.put("notes", result.notes());
        return summary;
    }

    List<Candidate> availableCandidates() { return List.copyOf(candidates.values()); }
    LinkedHashMap<String, Candidate> candidates() { return new LinkedHashMap<>(candidates); }

    private WalkingRouteResult route(RouteKey key) {
        validate(key);
        if (!routes.containsKey(key)) {
            consume();
            routes.put(key, walking.getWalkingRoute(new WalkingRouteRequest(stop(key.startStopId()).location(),
                    stop(key.endStopId()).location(), key.avoidStairs())));
        }
        return routes.get(key);
    }

    private void validate(RouteKey key) {
        stop(key.startStopId()); stop(key.endStopId());
        if (key.startStopId().equals(key.endStopId())) throw ApiException.badRequest("서로 다른 출발·도착 장소를 선택해 주세요.");
    }

    private YutoCourse.Stop stop(String id) {
        return course.stops().stream().filter(s -> s.id().equals(id)).findFirst()
                .orElseThrow(() -> ApiException.badRequest("현재 코스에 없는 장소 ID입니다. 코스의 장소를 선택해 주세요."));
    }

    private void consume() {
        if (++operations > 6) throw ApiException.badRequest("한 질문의 조회 횟수를 초과했습니다. 질문을 나누어 주세요.");
    }

    private static Map<String, Object> routeSummary(WalkingRouteResult route) {
        var instructions = route.instructions().stream().limit(40).toList();
        return Map.of("source", route.source(), "queriedAt", route.queriedAt(),
                "distanceMeters", route.distanceMeters(), "estimatedSeconds", route.estimatedSeconds(),
                "avoidStairsRequested", route.avoidStairsRequested(), "instructions", instructions,
                "instructionsTruncated", route.instructions().size() > 40, "notes", route.notes());
    }

    public record RouteKey(String startStopId, String endStopId, boolean avoidStairs) { }
    public record Candidate(RouteKey route, RoutePlaceSearchResult.Place place, Instant queriedAt) { }
}
