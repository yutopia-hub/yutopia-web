package com.yutopia.service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.yutopia.controller.dto.PlaceDtos.AreaResponse;
import com.yutopia.controller.dto.PlaceDtos.ImageResponse;
import com.yutopia.controller.dto.PlaceDtos.PlaceResponse;
import com.yutopia.exception.ApiException;
import com.yutopia.model.dao.PlaceImageDao;
import com.yutopia.model.dao.PlaceQueryDao;
import com.yutopia.model.dao.RegionDao;
import com.yutopia.model.dto.PlaceView;

import lombok.RequiredArgsConstructor;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
public class PlaceService {
    private static final int MAX_PAGE_SIZE = 100;

    private final PlaceQueryDao placeQueryDao;
    private final PlaceImageDao placeImageDao;
    private final RegionDao regionDao;
    private final JsonMapper jsonMapper;

    public List<PlaceResponse> search(String keyword, Long areaId, int page, int size) {
        int safeSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        int offset = (Math.max(page, 1) - 1) * safeSize;
        String trimmed = keyword == null ? null : keyword.trim();
        return placeQueryDao.search(trimmed, areaId, offset, safeSize).stream().map(PlaceService::toResponse).toList();
    }

    public PlaceResponse detail(String externalId) {
        PlaceView view = placeQueryDao.findDetail(externalId);
        if (view == null) throw ApiException.notFound("관광지 정보를 찾을 수 없습니다.");
        List<ImageResponse> images = placeImageDao.findByPlaceId(view.getPlaceId()).stream()
                .map(i -> new ImageResponse(i.getImageUrl(),
                        i.getThumbnailUrl() != null ? i.getThumbnailUrl() : i.getImageUrl(), i.getCaption()))
                .toList();
        PlaceResponse base = toResponse(view);
        return new PlaceResponse(base.id(), base.provider(), base.contentTypeId(), base.title(), base.address(),
                base.tel(), base.image(), base.thumbnail(), base.lat(), base.lng(), base.cat1(), base.cat2(),
                base.cat3(), base.areaCode(), base.areaName(), base.category(), base.tags(), base.setting(),
                base.petAllowed(), base.placeUrl(), view.getOverview(), view.getHomepageUrl(),
                readIntro(view.getIntroJson()), images, null, null);
    }

    /** 시도(level 1) 목록. code 는 이 서버의 region_id 이며 search(areaId) 에 그대로 쓴다. */
    public List<AreaResponse> areas() {
        return regionDao.findAll().stream()
                .filter(region -> Integer.valueOf(1).equals(region.getRegionLevel()))
                .map(region -> new AreaResponse(String.valueOf(region.getRegionId()), region.getRegionName()))
                .toList();
    }

    static PlaceResponse toResponse(PlaceView v) {
        String address = v.getDetailAddress() == null || v.getDetailAddress().isBlank() ? v.getAddress()
                : v.getAddress() + " " + v.getDetailAddress();
        return new PlaceResponse(
                v.getExternalId(), v.getProvider(), blankToNull(v.getContentTypeId()), v.getTitle(), address,
                v.getTel(), v.getImage(), v.getThumbnail(),
                v.getLatitude() == null ? null : v.getLatitude().doubleValue(),
                v.getLongitude() == null ? null : v.getLongitude().doubleValue(),
                v.getCat1(), v.getCat2(), v.getCat3(),
                v.getAreaId() == null ? null : String.valueOf(v.getAreaId()), v.getAreaName(), v.getCategoryName(),
                v.getTags() == null ? List.of() : Arrays.asList(v.getTags().split("\\|")),
                v.getSetting(), v.getPetAllowed(), v.getPlaceUrl(),
                null, null, null, null, v.getMemo(), v.getAddedAt());
    }

    private Map<String, Object> readIntro(String introJson) {
        if (introJson == null || introJson.isBlank()) return Map.of();
        try {
            Map<String, Object> root = jsonMapper.readValue(introJson, new TypeReference<Map<String, Object>>() {
            });
            Object intro = root.get("intro");
            if (intro instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> typed = (Map<String, Object>) map;
                return typed;
            }
            return Map.of();
        } catch (JacksonException e) {
            return Map.of();
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() || "null".equals(value) ? null : value;
    }
}
