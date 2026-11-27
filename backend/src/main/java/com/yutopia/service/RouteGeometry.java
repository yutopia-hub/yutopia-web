package com.yutopia.service;

import java.util.ArrayList;
import java.util.List;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.WalkingRouteResult.Coordinate;

/** Local tangent-plane approximation for short walking routes, never a walking-distance estimate. */
final class RouteGeometry {
    private static final double EARTH_RADIUS = 6_371_000;
    private final List<Coordinate> path;
    private final double[] xs, ys, cumulative;
    private final double originLng, originLat, lngScale;

    RouteGeometry(List<Coordinate> coordinates) {
        if (coordinates == null || coordinates.size() < 2 || coordinates.size() > 5000) {
            throw ApiException.badRequest("보행 경로 좌표는 2~5000개가 필요합니다.");
        }
        for (Coordinate point : coordinates) {
            if (point == null || !Double.isFinite(point.lat()) || !Double.isFinite(point.lng())
                    || Math.abs(point.lat()) > 85 || Math.abs(point.lng()) > 180) {
                throw ApiException.badRequest("유효한 보행 경로 좌표가 필요합니다.");
            }
        }
        path = List.copyOf(coordinates);
        originLng = path.get(0).lng();
        originLat = path.get(0).lat();
        lngScale = Math.cos(Math.toRadians(originLat));
        xs = new double[path.size()];
        ys = new double[path.size()];
        cumulative = new double[path.size()];
        for (int i = 0; i < path.size(); i++) {
            xs[i] = x(path.get(i));
            ys[i] = y(path.get(i));
            if (i > 0) cumulative[i] = cumulative[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
        }
        if (length() < 1 || length() > 30_000) {
            throw ApiException.badRequest("주변 검색은 길이 1m~30km의 보행 구간 단위로 요청해 주세요.");
        }
    }

    double length() { return cumulative[cumulative.length - 1]; }

    List<Coordinate> anchors(int radiusMeters) {
        int count = Math.min(4, Math.max(2, (int) Math.ceil(length() / (radiusMeters * 2.0)) + 1));
        List<Coordinate> result = new ArrayList<>();
        for (int i = 0; i < count; i++) result.add(at(length() * i / (count - 1)));
        return result;
    }

    Projection project(Coordinate place) {
        double px = x(place), py = y(place), best = Double.POSITIVE_INFINITY;
        double along = 0;
        Coordinate nearest = path.get(0);
        for (int i = 1; i < path.size(); i++) {
            double dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1];
            double squared = dx * dx + dy * dy;
            double t = squared == 0 ? 0 : Math.clamp(((px - xs[i - 1]) * dx + (py - ys[i - 1]) * dy) / squared, 0, 1);
            double nx = xs[i - 1] + t * dx, ny = ys[i - 1] + t * dy;
            double distance = Math.hypot(px - nx, py - ny);
            if (distance < best) {
                best = distance;
                along = cumulative[i - 1] + t * Math.sqrt(squared);
                nearest = coordinate(nx, ny);
            }
        }
        return new Projection(best, along, nearest);
    }

    private Coordinate at(double distance) {
        for (int i = 1; i < path.size(); i++) {
            if (cumulative[i] >= distance) {
                double segment = cumulative[i] - cumulative[i - 1];
                double t = segment == 0 ? 0 : (distance - cumulative[i - 1]) / segment;
                return coordinate(xs[i - 1] + t * (xs[i] - xs[i - 1]), ys[i - 1] + t * (ys[i] - ys[i - 1]));
            }
        }
        return path.get(path.size() - 1);
    }

    private double x(Coordinate p) { return EARTH_RADIUS * Math.toRadians(p.lng() - originLng) * lngScale; }
    private double y(Coordinate p) { return EARTH_RADIUS * Math.toRadians(p.lat() - originLat); }
    private Coordinate coordinate(double x, double y) {
        return new Coordinate(originLng + Math.toDegrees(x / EARTH_RADIUS / lngScale),
                originLat + Math.toDegrees(y / EARTH_RADIUS));
    }

    record Projection(double distance, double along, Coordinate nearest) { }
}
