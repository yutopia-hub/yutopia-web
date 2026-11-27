package com.yutopia.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import com.yutopia.resource.WalkingRouteRequest;
import com.yutopia.resource.WalkingRouteResult;
import com.yutopia.service.WalkingRouteService;

@Component
public class WalkingRouteTool {
    private final WalkingRouteService service;

    public WalkingRouteTool(WalkingRouteService service) {
        this.service = service;
    }

    @Tool(description = "조회로 확인된 출발지·도착지 좌표의 TMAP 보행 경로, 거리(m), 예상 시간(초·분), "
            + "육교·계단 등 제공된 안내를 조회합니다. 좌표를 추측하지 마세요. "
            + "시설 안내 누락은 시설 부재를 의미하지 않으며 이동 시간은 예상값입니다.")
    public WalkingRouteResult getWalkingRoute(
            @ToolParam(description = "현재 코스 또는 장소 조회로 확보한 start/end(name,lat,lng), "
                    + "계단 제외 요청 여부 avoidStairs") WalkingRouteRequest request) {
        return service.findRoute(request);
    }
}
