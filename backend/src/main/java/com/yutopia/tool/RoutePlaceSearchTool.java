package com.yutopia.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import com.yutopia.resource.RoutePlaceSearchRequest;
import com.yutopia.resource.RoutePlaceSearchResult;
import com.yutopia.service.RoutePlaceSearchService;

@Component
public class RoutePlaceSearchTool {
    private final RoutePlaceSearchService service;

    public RoutePlaceSearchTool(RoutePlaceSearchService service) { this.service = service; }

    @Tool(description = "보행 경로 조회 결과의 실제 path를 입력받아 경로 주변 음식점·경찰서/지구대/파출소·카페·편의점·약국을 검색합니다. "
            + "출발/도착점만 연결한 추측 경로를 만들지 마세요. 거리 값은 경로와의 직선 이격 거리이며 도보 시간으로 해석하지 마세요. "
            + "partial/truncated와 notes를 반영하고 결과 없음이 시설 부재를 의미한다고 말하지 마세요.")
    public RoutePlaceSearchResult searchPlacesAlongRoute(
            @ToolParam(description = "getWalkingRoute 결과의 path, kind(RESTAURANT/POLICE/CAFE/CONVENIENCE_STORE/PHARMACY), "
                    + "radiusMeters(기본200,50~1000), limit(기본5,1~10)") RoutePlaceSearchRequest request) {
        return service.search(request);
    }
}
