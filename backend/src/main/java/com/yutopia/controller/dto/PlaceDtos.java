package com.yutopia.controller.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 여행지·찜 API 요청/응답. 필드 이름은 프론트 tourApi.normalizePlace() 결과와 같게 맞췄다. */
public final class PlaceDtos {
    private PlaceDtos() {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PlaceResponse(
            String id,
            String provider,
            String contentTypeId,
            String title,
            String address,
            String tel,
            String image,
            String thumbnail,
            Double lat,
            Double lng,
            String cat1,
            String cat2,
            String cat3,
            String areaCode,
            String areaName,
            String category,
            List<String> tags,
            String setting,
            Boolean petAllowed,
            String placeUrl,
            // 상세 조회에서만
            String overview,
            String homepage,
            Map<String, Object> intro,
            List<ImageResponse> images,
            // 찜 조회에서만
            String memo,
            LocalDateTime addedAt) {
    }

    public record ImageResponse(String url, String thumbnail, String name) {
    }

    public record AreaResponse(String code, String name) {
    }

    /** 찜 담기: 서버 DB 에 없는 여행지(TourAPI·카카오)도 스냅샷으로 함께 저장한다. */
    public record FavoriteRequest(
            String provider,
            String title,
            String address,
            Double lat,
            Double lng,
            String image,
            String thumbnail,
            String contentTypeId,
            String placeUrl,
            String memo) {
    }

    public record MemoRequest(String memo) {
    }
}
