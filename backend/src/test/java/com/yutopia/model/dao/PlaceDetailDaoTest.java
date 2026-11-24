package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;

class PlaceDetailDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("상세정보를 등록하고 모든 컬럼과 JSON 날짜 기본 실내외 구분을 조회한다")
    void insertAndFindByPlaceId() {
        var place = place(); var detail = detail(place);
        assertEquals(1, details.insert(detail));
        var found = details.findByPlaceId(place.getPlaceId());
        assertAll(() -> assertEquals(place.getPlaceId(), found.getPlaceId()),
                () -> assertEquals(detail.getOverview(), found.getOverview()),
                () -> assertEquals(detail.getTel(), found.getTel()),
                () -> assertEquals(detail.getHomepageUrl(), found.getHomepageUrl()),
                () -> assertEquals(detail.getOpeningHours(), found.getOpeningHours()),
                () -> assertEquals(detail.getClosedDays(), found.getClosedDays()),
                () -> assertEquals(detail.getAdmissionFee(), found.getAdmissionFee()),
                () -> assertEquals(detail.getParkingInfo(), found.getParkingInfo()),
                () -> assertTrue(found.getPetAllowed()), () -> assertFalse(found.getReservationRequired()),
                () -> assertEquals("UNKNOWN", found.getSetting()),
                () -> assertTrue(found.getIntroJson().contains("테스트 안내")),
                () -> assertEquals(detail.getFetchedAt(), found.getFetchedAt()));
    }

    @Test
    @DisplayName("상세정보 수정 시 내용과 Boolean ENUM JSON 및 시각을 갱신한다")
    void update() {
        var detail = detail(place()); details.insert(detail);
        detail.setOverview("변경된 설명"); detail.setTel("051-123-4567");
        detail.setHomepageUrl("https://example.invalid/changed"); detail.setOpeningHours("10:00~20:00");
        detail.setClosedDays("화요일"); detail.setAdmissionFee("1000원"); detail.setParkingInfo("주차 불가");
        detail.setPetAllowed(false); detail.setReservationRequired(true); detail.setSetting("INDOOR");
        detail.setIntroJson("{\"info\":\"새 안내\"}"); detail.setFetchedAt(detail.getFetchedAt().plusDays(1));
        assertEquals(1, details.update(detail));
        var found = details.findByPlaceId(detail.getPlaceId());
        assertAll(() -> assertEquals(detail.getOverview(), found.getOverview()),
                () -> assertEquals(detail.getTel(), found.getTel()),
                () -> assertEquals(detail.getHomepageUrl(), found.getHomepageUrl()),
                () -> assertEquals(detail.getOpeningHours(), found.getOpeningHours()),
                () -> assertEquals(detail.getClosedDays(), found.getClosedDays()),
                () -> assertEquals(detail.getAdmissionFee(), found.getAdmissionFee()),
                () -> assertEquals(detail.getParkingInfo(), found.getParkingInfo()),
                () -> assertFalse(found.getPetAllowed()), () -> assertTrue(found.getReservationRequired()),
                () -> assertEquals("INDOOR", found.getSetting()),
                () -> assertTrue(found.getIntroJson().contains("새 안내")),
                () -> assertEquals(detail.getFetchedAt(), found.getFetchedAt()));
    }

    @Test
    @DisplayName("상세정보의 nullable 컬럼을 null로 지울 수 있다")
    void clearNullableValues() {
        var detail = detail(place()); details.insert(detail);
        detail.setOverview(null); detail.setTel(null); detail.setHomepageUrl(null);
        detail.setOpeningHours(null); detail.setClosedDays(null); detail.setAdmissionFee(null);
        detail.setParkingInfo(null); detail.setPetAllowed(null); detail.setReservationRequired(null);
        detail.setIntroJson(null); detail.setFetchedAt(null); detail.setSetting("UNKNOWN");
        assertEquals(1, details.update(detail));
        var found = details.findByPlaceId(detail.getPlaceId());
        assertAll(() -> assertNull(found.getOverview()), () -> assertNull(found.getTel()),
                () -> assertNull(found.getHomepageUrl()), () -> assertNull(found.getOpeningHours()),
                () -> assertNull(found.getClosedDays()), () -> assertNull(found.getAdmissionFee()),
                () -> assertNull(found.getParkingInfo()), () -> assertNull(found.getPetAllowed()),
                () -> assertNull(found.getReservationRequired()), () -> assertNull(found.getIntroJson()),
                () -> assertNull(found.getFetchedAt()));
    }

    @Test
    @DisplayName("상세정보 삭제 후 조회되지 않는다")
    void deleteByPlaceId() {
        var detail = detail(place()); details.insert(detail);
        assertEquals(1, details.deleteByPlaceId(detail.getPlaceId()));
        assertNull(details.findByPlaceId(detail.getPlaceId()));
        assertEquals(0, details.deleteByPlaceId(detail.getPlaceId()));
    }

    @Test
    @DisplayName("존재하지 않는 장소의 상세정보는 null을 반환한다")
    void missingDetail() {
        assertNull(details.findByPlaceId(missingPlaceId()));
    }

    @Test
    @DisplayName("부모 장소가 없으면 상세정보 등록을 FK 제약으로 거부한다")
    void foreignKey() {
        var detail = detail(place()); detail.setPlaceId(missingPlaceId());
        assertThrows(DataIntegrityViolationException.class, () -> details.insert(detail));
    }

    @Test
    @DisplayName("한 장소에 상세정보를 중복 등록하면 PK 제약으로 거부한다")
    void duplicatePlaceId() {
        var detail = detail(place()); details.insert(detail);
        assertThrows(DuplicateKeyException.class, () -> details.insert(detail));
    }

    @Test
    @DisplayName("장소 삭제 시 상세정보는 CASCADE로 삭제된다")
    void cascadeDelete() {
        var detail = detail(place()); details.insert(detail);
        assertEquals(1, places.deleteById(detail.getPlaceId()));
        assertNull(details.findByPlaceId(detail.getPlaceId()));
    }
}
