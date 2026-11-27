package com.yutopia.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import com.yutopia.resource.DetourTimeComparisonRequest;
import com.yutopia.resource.DetourTimeComparisonResult;
import com.yutopia.service.DetourTimeComparisonService;

@Component
public class DetourTimeComparisonTool {
    private final DetourTimeComparisonService service;

    public DetourTimeComparisonTool(DetourTimeComparisonService service) { this.service = service; }

    @Tool(description = "현재 보행 구간에 검색으로 확인한 장소 한 곳을 들를 때의 이동 시간·거리 차이를 비교합니다. "
            + "동일 조건의 원래 경로와 경유 경로를 TMAP에서 각 1회 조회합니다. 좌표나 식사 시간을 추측하지 마세요. "
            + "차이는 부호 있는 값으로 음수일 수도 있습니다. 이동 시간과 사용자 지정 체류 시간을 구분해 답하세요.")
    public DetourTimeComparisonResult compareDetourTime(
            @ToolParam(description = "현재 구간 start/end(name,lat,lng), 장소 검색에서 확인한 via(name,lat,lng), "
                    + "avoidStairs, 사용자가 명시한 경우에만 visitMinutes(0~1440), 미지정은 null") DetourTimeComparisonRequest request) {
        return service.compare(request);
    }
}
