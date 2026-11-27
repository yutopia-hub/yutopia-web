package com.yutopia.resource;

import java.util.HashSet;
import java.util.List;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.WalkingRouteRequest.Location;

/** Immutable, client-selected itinerary. Provider facts must still be looked up. */
public record YutoCourse(String courseId, String title, List<Stop> stops) {
    public YutoCourse {
        if (courseId == null || courseId.isBlank() || courseId.length() > 100
                || title == null || title.isBlank() || title.length() > 100
                || stops == null || stops.size() < 2 || stops.size() > 12) {
            throw ApiException.badRequest("코스 ID·이름과 2~12개의 장소가 필요합니다.");
        }
        var ids = new HashSet<String>();
        for (Stop stop : stops) {
            if (stop == null || !ids.add(stop.id())) throw ApiException.badRequest("코스 장소 ID가 중복되었거나 유효하지 않습니다.");
        }
        stops = List.copyOf(stops);
    }

    public record Stop(String id, String title, Double lat, Double lng) {
        public Stop {
            if (id == null || !id.matches("[A-Za-z0-9:_-]{1,64}") || title == null || title.isBlank() || title.length() > 100
                    || lat == null || lng == null || !Double.isFinite(lat) || !Double.isFinite(lng)
                    || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
                throw ApiException.badRequest("코스 장소의 ID·이름·좌표를 확인해 주세요.");
            }
        }
        public Location location() { return new Location(title, lat, lng); }
    }
}
