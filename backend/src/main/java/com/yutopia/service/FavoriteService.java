package com.yutopia.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yutopia.controller.dto.PlaceDtos.FavoriteRequest;
import com.yutopia.controller.dto.PlaceDtos.PlaceResponse;
import com.yutopia.exception.ApiException;
import com.yutopia.model.dao.FavoriteDao;
import com.yutopia.model.dao.PlaceDao;
import com.yutopia.model.dao.PlaceDetailDao;
import com.yutopia.model.dao.PlaceImageDao;
import com.yutopia.model.dao.PlaceQueryDao;
import com.yutopia.model.dto.Favorite;
import com.yutopia.model.dto.Member;
import com.yutopia.model.dto.Place;
import com.yutopia.model.dto.PlaceDetail;
import com.yutopia.model.dto.PlaceImage;
import com.yutopia.model.dto.PlaceView;

import lombok.RequiredArgsConstructor;
import tools.jackson.databind.json.JsonMapper;

/** 보따리(찜). 프론트 carrierStore 의 서버 저장소 역할. */
@Service
@RequiredArgsConstructor
public class FavoriteService {
    private static final Set<String> PROVIDERS = Set.of("TOUR_API", "KAKAO", "USER");
    private static final int MEMO_MAX = 1000;

    private final FavoriteDao favoriteDao;
    private final PlaceDao placeDao;
    private final PlaceDetailDao placeDetailDao;
    private final PlaceImageDao placeImageDao;
    private final PlaceQueryDao placeQueryDao;
    private final JsonMapper jsonMapper;

    public List<PlaceResponse> list(Member member) {
        return placeQueryDao.findFavorites(member.getMemberId()).stream().map(PlaceService::toResponse).toList();
    }

    /** 멱등: 이미 담겨 있으면 그대로 돌려준다. DB 에 없는 여행지는 요청 스냅샷으로 만든다. */
    @Transactional
    public PlaceResponse add(Member member, String externalId, FavoriteRequest request) {
        String id = requireExternalId(externalId);
        PlaceView existing = placeQueryDao.findFavorite(member.getMemberId(), id);
        if (existing != null) return PlaceService.toResponse(existing);

        Place place = findOrCreatePlace(id, request);
        Favorite favorite = new Favorite();
        favorite.setMemberId(member.getMemberId());
        favorite.setPlaceId(place.getPlaceId());
        favorite.setMemo(memo(request == null ? null : request.memo()));
        favoriteDao.insert(favorite);
        return PlaceService.toResponse(placeQueryDao.findFavorite(member.getMemberId(), id));
    }

    @Transactional
    public PlaceResponse updateMemo(Member member, String externalId, String memo) {
        PlaceView favorite = requireFavorite(member, externalId);
        favoriteDao.updateMemo(member.getMemberId(), favorite.getPlaceId(), memo(memo));
        return PlaceService.toResponse(placeQueryDao.findFavorite(member.getMemberId(), favorite.getExternalId()));
    }

    @Transactional
    public void remove(Member member, String externalId) {
        PlaceView favorite = placeQueryDao.findFavorite(member.getMemberId(), requireExternalId(externalId));
        if (favorite != null) favoriteDao.delete(member.getMemberId(), favorite.getPlaceId()); // 멱등
    }

    private PlaceView requireFavorite(Member member, String externalId) {
        PlaceView favorite = placeQueryDao.findFavorite(member.getMemberId(), requireExternalId(externalId));
        if (favorite == null) throw ApiException.notFound("보따리에 없는 여행지입니다.");
        return favorite;
    }

    private Place findOrCreatePlace(String externalId, FavoriteRequest request) {
        String provider = request != null && request.provider() != null && PROVIDERS.contains(request.provider())
                ? request.provider() : "TOUR_API";
        Place place = placeDao.findByExternalId(provider, externalId);
        if (place != null) return place;
        if (request == null || request.title() == null || request.title().isBlank()) {
            throw ApiException.badRequest("새 여행지를 담으려면 여행지 이름이 필요합니다.");
        }

        place = new Place();
        place.setProvider(provider);
        place.setExternalId(externalId);
        place.setTitle(truncate(request.title().trim(), 500));
        place.setAddress(truncate(request.address(), 500));
        if (validCoordinates(request.lat(), request.lng())) {
            place.setLatitude(BigDecimal.valueOf(request.lat()).setScale(7, RoundingMode.HALF_UP));
            place.setLongitude(BigDecimal.valueOf(request.lng()).setScale(7, RoundingMode.HALF_UP));
        }
        place.setPlaceUrl(truncate(request.placeUrl(), 2048));
        place.setIsActive(true);
        placeDao.insert(place);

        if (request.contentTypeId() != null && !request.contentTypeId().isBlank()) {
            PlaceDetail detail = new PlaceDetail();
            detail.setPlaceId(place.getPlaceId());
            detail.setIntroJson(jsonMapper.writeValueAsString(
                    Map.of("contentId", externalId, "contentTypeId", request.contentTypeId(), "source", "favorite")));
            placeDetailDao.insert(detail);
        }
        if (request.image() != null && request.image().startsWith("http")) {
            PlaceImage image = new PlaceImage();
            image.setPlaceId(place.getPlaceId());
            image.setImageUrl(truncate(request.image(), 2048));
            image.setThumbnailUrl(truncate(request.thumbnail(), 2048));
            image.setCaption(truncate(request.title(), 255));
            image.setSortOrder(1);
            placeImageDao.insert(image);
        }
        return place;
    }

    private static String requireExternalId(String externalId) {
        if (externalId == null || externalId.isBlank() || externalId.length() > 100
                || !externalId.chars().allMatch(c -> c > 32 && c < 127)) {
            throw ApiException.badRequest("여행지 ID가 올바르지 않습니다.");
        }
        return externalId;
    }

    private static boolean validCoordinates(Double lat, Double lng) {
        return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
                && !(lat == 0 && lng == 0);
    }

    private static String memo(String memo) {
        if (memo == null) return null;
        String trimmed = memo.trim();
        if (trimmed.length() > MEMO_MAX) throw ApiException.badRequest("메모는 1000자 이내로 입력해 주세요.");
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String truncate(String value, int max) {
        if (value == null || value.isBlank()) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
