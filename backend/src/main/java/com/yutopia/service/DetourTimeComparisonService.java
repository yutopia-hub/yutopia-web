package com.yutopia.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.DetourTimeComparisonRequest;
import com.yutopia.resource.DetourTimeComparisonResult;
import com.yutopia.resource.WalkingRouteRequest;

@Service
public class DetourTimeComparisonService {
    private final WalkingRouteService walkingRoutes;

    public DetourTimeComparisonService(WalkingRouteService walkingRoutes) {
        this.walkingRoutes = walkingRoutes;
    }

    public DetourTimeComparisonResult compare(DetourTimeComparisonRequest request) {
        if (request == null) throw ApiException.badRequest("비교할 출발지·도착지·경유지가 필요합니다.");
        // Validate everything before the first paid/provider request.
        WalkingRouteService.validateLocation(request.start());
        WalkingRouteService.validateLocation(request.end());
        WalkingRouteService.validateLocation(request.via());
        if (request.visitMinutes() != null && (request.visitMinutes() < 0 || request.visitMinutes() > 1440)) {
            throw ApiException.badRequest("사용자가 지정하는 체류 시간은 0~1440분이어야 합니다.");
        }
        var routeRequest = new WalkingRouteRequest(request.start(), request.end(), request.avoidStairs());
        // Re-query both routes under identical options instead of comparing with stale UI estimates.
        var original = walkingRoutes.findRoute(routeRequest);
        var detour = walkingRoutes.findRouteVia(routeRequest, request.via());
        long secondsDifference = detour.estimatedSeconds() - original.estimatedSeconds();
        Long totalWithVisit = null, extraWithVisit = null;
        if (request.visitMinutes() != null) {
            try {
                totalWithVisit = Math.addExact(detour.estimatedSeconds(), request.visitMinutes().longValue() * 60);
                extraWithVisit = totalWithVisit - original.estimatedSeconds();
            } catch (ArithmeticException e) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "경유 시간 계산 범위를 벗어난 응답을 받았습니다.");
            }
        }
        var notes = new ArrayList<>(List.of(
                "같은 출발지·도착지·계단 제외 옵션으로 원래 경로와 경유 경로를 새로 조회한 예상값입니다.",
                "시간 차이는 경유 이동 시간에서 원래 이동 시간을 뺀 초 단위 값입니다. 표시용 올림 분끼리 빼지 않습니다.",
                "식사·관람·대기 시간은 이동 시간 차이에 포함되지 않습니다. 영업 여부나 실시간 이용 가능 여부는 확인하지 않습니다."));
        if (request.visitMinutes() == null) {
            notes.add("체류 시간이 지정되지 않아 체류 포함 총 시간·추가 시간은 제공하지 않습니다.");
        } else {
            notes.add("체류 포함 값은 사용자가 명시한 체류 시간만 더한 예상값입니다.");
        }
        if (secondsDifference < 0) {
            notes.add("경유 경로의 예상 시간이 더 짧게 조회되었습니다. 경로 탐색 결과의 차이이며 경유가 항상 시간을 줄인다는 뜻은 아닙니다.");
        }
        return new DetourTimeComparisonResult("TMAP", "walk", Instant.now(), request.via(), original, detour,
                detour.distanceMeters() - original.distanceMeters(), secondsDifference, secondsDifference / 60.0,
                request.visitMinutes(), totalWithVisit, extraWithVisit, List.copyOf(notes));
    }
}
