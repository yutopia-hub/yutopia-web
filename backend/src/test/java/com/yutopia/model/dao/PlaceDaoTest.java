package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

class PlaceDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("여행지 등록 시 생성 키 좌표 문자열과 기본 활성 여부를 매핑한다")
    void insert() {
        var region = region("서울", null);
        var category = category("음식점", null);
        var place = newPlace("첫 여행지", region.getRegionId(), category.getCategoryId());
        assertEquals(1, places.insert(place));
        var found = places.findById(place.getPlaceId());
        assertAll(() -> assertEquals(place.getTitle(), found.getTitle()),
                () -> assertEquals(place.getProvider(), found.getProvider()),
                () -> assertEquals(place.getExternalId(), found.getExternalId()),
                () -> assertEquals(place.getAddress(), found.getAddress()),
                () -> assertEquals(place.getDetailAddress(), found.getDetailAddress()),
                () -> assertEquals(place.getZipcode(), found.getZipcode()),
                () -> assertEquals(place.getPlaceUrl(), found.getPlaceUrl()),
                () -> assertEquals(region.getRegionId(), found.getRegionId()),
                () -> assertEquals(category.getCategoryId(), found.getCategoryId()),
                () -> assertEquals(0, place.getLatitude().compareTo(found.getLatitude())),
                () -> assertEquals(0, place.getLongitude().compareTo(found.getLongitude())),
                () -> assertTrue(found.getIsActive()),
                () -> assertNotNull(found.getCreatedAt()), () -> assertNotNull(found.getUpdatedAt()));
    }

    @Test
    @DisplayName("여행지 ID로 다른 장소와 구분해 조회한다")
    void findById() {
        var first = place();
        var second = place();
        assertEquals(first.getExternalId(), places.findById(first.getPlaceId()).getExternalId());
        assertNotEquals(second.getPlaceId(), first.getPlaceId());
    }

    @Test
    @DisplayName("전체 여행지 조회에 이번 테스트에서 등록한 3개 장소가 모두 포함된다")
    void findAll() {
        var a = place(); var b = place(); var c = place();
        var ids = places.findAll().stream().filter(p -> p.getTitle().startsWith(prefix)).map(p -> p.getPlaceId()).toList();
        assertEquals(List.of(a.getPlaceId(), b.getPlaceId(), c.getPlaceId()), ids);
    }

    @Test
    @DisplayName("이름 부분 검색은 일치하는 두 장소만 조회한다")
    void searchByTitle() {
        var a = place("동산 공원", null, null);
        var b = place("동산 전망대", null, null);
        place("역사 박물관", null, null);
        assertEquals(List.of(a.getPlaceId(), b.getPlaceId()), placeIds(places.searchByTitle(prefix + " 동산")));
        assertTrue(places.searchByTitle(prefix + " 없는이름").isEmpty());
    }

    @Test
    @DisplayName("지역 검색은 다른 지역의 장소를 제외한다")
    void findByRegionId() {
        var seoul = region("서울", null); var busan = region("부산", null);
        var a = place("첫 장소", seoul.getRegionId(), null);
        var b = place("두번째 장소", seoul.getRegionId(), null);
        place("부산 장소", busan.getRegionId(), null);
        assertEquals(List.of(a.getPlaceId(), b.getPlaceId()), placeIds(places.findByRegionId(seoul.getRegionId())));
    }

    @Test
    @DisplayName("카테고리 검색은 다른 분류의 장소를 제외한다")
    void findByCategoryId() {
        var food = category("음식점", null); var culture = category("문화시설", null);
        var a = place("한식", null, food.getCategoryId());
        var b = place("양식", null, food.getCategoryId());
        place("박물관", null, culture.getCategoryId());
        assertEquals(List.of(a.getPlaceId(), b.getPlaceId()), placeIds(places.findByCategoryId(food.getCategoryId())));
    }

    @Test
    @DisplayName("여행지 수정 시 nullable 컬럼을 지우고 비활성 및 새 좌표를 저장한다")
    void update() {
        var place = place();
        var createdAt = places.findById(place.getPlaceId()).getCreatedAt();
        place.setRegionId(null); place.setCategoryId(null);
        place.setTitle(prefix + " 수정된 장소"); place.setProvider("KAKAO");
        place.setExternalId("changed-" + prefix);
        place.setAddress(null); place.setDetailAddress(null); place.setZipcode(null); place.setPlaceUrl(null);
        place.setLatitude(new BigDecimal("35.1234567")); place.setLongitude(new BigDecimal("129.1234567"));
        place.setIsActive(false);
        assertEquals(1, places.update(place));
        var found = places.findById(place.getPlaceId());
        assertAll(() -> assertEquals(place.getTitle(), found.getTitle()),
                () -> assertEquals("KAKAO", found.getProvider()),
                () -> assertEquals(place.getExternalId(), found.getExternalId()),
                () -> assertNull(found.getRegionId()), () -> assertNull(found.getCategoryId()),
                () -> assertNull(found.getAddress()), () -> assertNull(found.getDetailAddress()),
                () -> assertNull(found.getZipcode()), () -> assertNull(found.getPlaceUrl()),
                () -> assertEquals(place.getLatitude(), found.getLatitude()),
                () -> assertEquals(place.getLongitude(), found.getLongitude()),
                () -> assertFalse(found.getIsActive()), () -> assertEquals(createdAt, found.getCreatedAt()));
    }

    @Test
    @DisplayName("여행지를 삭제하면 다른 장소는 유지된다")
    void deleteById() {
        var target = place(); var other = place();
        assertEquals(1, places.deleteById(target.getPlaceId()));
        assertNull(places.findById(target.getPlaceId()));
        assertEquals(other.getTitle(), places.findById(other.getPlaceId()).getTitle());
        assertEquals(0, places.deleteById(target.getPlaceId()));
    }

    @Test
    @DisplayName("존재하지 않는 여행지는 null을 반환한다")
    void missingPlace() {
        assertNull(places.findById(missingPlaceId()));
    }

    @Test
    @DisplayName("같은 provider와 external_id 조합의 중복을 거부한다")
    void duplicateExternalId() {
        var original = place();
        var duplicate = newPlace("중복", null, null);
        duplicate.setExternalId(original.getExternalId());
        assertThrows(DuplicateKeyException.class, () -> places.insert(duplicate));
        duplicate.setProvider("KAKAO");
        assertEquals(1, places.insert(duplicate));
    }

    @Test
    @DisplayName("좌표는 둘 다 null일 수 있고 하나만 null이면 CHECK 제약으로 거부한다")
    void coordinateConstraint() {
        var place = newPlace("좌표 없음", null, null);
        place.setLatitude(null); place.setLongitude(null);
        assertEquals(1, places.insert(place));
        assertNull(places.findById(place.getPlaceId()).getLatitude());
        var invalid = newPlace("불완전 좌표", null, null);
        invalid.setLongitude(null);
        assertCheckViolation("ck_places_coords", () -> places.insert(invalid));
        assertTrue(places.searchByTitle(invalid.getTitle()).isEmpty());
    }
}
