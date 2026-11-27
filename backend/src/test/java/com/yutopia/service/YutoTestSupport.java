package com.yutopia.service;

import java.time.Instant;
import java.util.List;

import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import com.yutopia.prompt.YutoPrompt;
import com.yutopia.resource.*;
import com.yutopia.resource.WalkingRouteResult.Coordinate;
import com.yutopia.tool.*;

import tools.jackson.databind.json.JsonMapper;

/** Deterministic providers: methods never delegate to an HTTP client. */
public final class YutoTestSupport {
    public static final JsonMapper JSON = JsonMapper.builder().build();
    public final WalkingStub walking = new WalkingStub();
    public final SearchStub search = new SearchStub();
    public final WalkingRouteTool walkingTool = new WalkingRouteTool(walking);
    public final RoutePlaceSearchTool searchTool = new RoutePlaceSearchTool(search);
    public final DetourTimeComparisonTool detourTool = new DetourTimeComparisonTool(new DetourTimeComparisonService(walking));

    public static YutoCourse course(String id) {
        return new YutoCourse(id, "추천 코스", List.of(new YutoCourse.Stop("a", "첫 장소", 37.0, 127.0),
                new YutoCourse.Stop("b", "다음 장소", 37.0, 127.002)));
    }

    public YutoChatService service(YutoConversationStore store, YutoModel model) {
        return new YutoChatService(store, new YutoChatEngine(model, new YutoPrompt(JSON), JSON, walkingTool, searchTool, detourTool));
    }

    public static final class WalkingStub extends WalkingRouteService {
        public int directCalls, viaCalls;
        WalkingStub() { super(RestClient.builder().requestFactory(new SimpleClientHttpRequestFactory()).build(), JSON, "unused"); }
        @Override public WalkingRouteResult findRoute(WalkingRouteRequest request) {
            directCalls++; return route(request, 600);
        }
        @Override public WalkingRouteResult findRouteVia(WalkingRouteRequest request, WalkingRouteRequest.Location via) {
            viaCalls++; return route(request, 780);
        }
        private WalkingRouteResult route(WalkingRouteRequest r, int seconds) {
            return new WalkingRouteResult("TMAP", "walk", Instant.now(), r.start(), r.end(), 1000, seconds, seconds / 60,
                    r.avoidStairs(), List.of(new Coordinate(r.start().lng(), r.start().lat()), new Coordinate(r.end().lng(), r.end().lat())),
                    List.of(), List.of("예상 이동 시간"));
        }
    }

    public static final class SearchStub extends RoutePlaceSearchService {
        public int calls;
        public List<Coordinate> receivedPath;
        SearchStub() { super(RestClient.builder().requestFactory(new SimpleClientHttpRequestFactory()).build(), JSON, "unused"); }
        @Override public RoutePlaceSearchResult search(RoutePlaceSearchRequest request) {
            calls++; receivedPath = request.path();
            var place = new RoutePlaceSearchResult.Place("kakao:food", "경로 식당", "음식점", "주소", "", "",
                    37.0005, 127.001, 50, 80, request.path().get(0));
            return new RoutePlaceSearchResult("KAKAO", Instant.now(), request.kind(), 200, 178, 2, 2, false, false,
                    List.of(place), List.of("직선 이격 거리"));
        }
    }
}
