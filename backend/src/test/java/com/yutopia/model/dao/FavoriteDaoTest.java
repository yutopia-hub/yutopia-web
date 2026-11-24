package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;

import com.yutopia.model.dto.Favorite;

class FavoriteDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("회원의 찜 등록 후 복합 키 메모와 생성 시각을 조회한다")
    void insert() {
        var member = member(); var place = place(); favorite(member, place, "가보고 싶은 곳");
        var rows = favorites.findByMemberId(member.getMemberId());
        assertEquals(1, rows.size());
        var found = rows.get(0);
        assertAll(() -> assertEquals(member.getMemberId(), found.getMemberId()),
                () -> assertEquals(place.getPlaceId(), found.getPlaceId()),
                () -> assertEquals("가보고 싶은 곳", found.getMemo()),
                () -> assertNotNull(found.getCreatedAt()));
    }

    @Test
    @DisplayName("회원별 찜 목록은 다른 회원의 장소와 메모를 제외한다")
    void findByMemberIdIsolatesMembers() {
        var a = member(); var b = member(); var first = place(); var second = place(); var third = place();
        favorite(a, first, "A 첫째"); favorite(a, second, "A 둘째");
        favorite(b, first, "B 공통 장소"); favorite(b, third, "B 전용 장소");
        var found = favorites.findByMemberId(a.getMemberId());
        assertEquals(Set.of(first.getPlaceId(), second.getPlaceId()), Set.copyOf(found.stream().map(Favorite::getPlaceId).toList()));
        assertTrue(found.stream().allMatch(f -> a.getMemberId().equals(f.getMemberId()) && f.getMemo().startsWith("A ")));
    }

    @Test
    @DisplayName("특정 회원과 장소의 찜 여부는 등록 여부에 따라 달라진다")
    void exists() {
        var member = member(); var place = place();
        assertFalse(favorites.exists(member.getMemberId(), place.getPlaceId()));
        favorite(member, place, null);
        assertTrue(favorites.exists(member.getMemberId(), place.getPlaceId()));
    }

    @Test
    @DisplayName("찜 취소는 지정 회원의 장소만 삭제하고 다른 회원의 찜은 유지한다")
    void delete() {
        var a = member(); var b = member(); var place = place();
        favorite(a, place, "A"); favorite(b, place, "B");
        assertEquals(1, favorites.delete(a.getMemberId(), place.getPlaceId()));
        assertFalse(favorites.exists(a.getMemberId(), place.getPlaceId()));
        assertTrue(favorites.findByMemberId(a.getMemberId()).isEmpty());
        assertTrue(favorites.exists(b.getMemberId(), place.getPlaceId()));
        assertEquals(0, favorites.delete(a.getMemberId(), place.getPlaceId()));
    }

    @Test
    @DisplayName("동일 회원과 장소의 중복 찜을 복합 PK로 거부한다")
    void duplicateFavorite() {
        var member = member(); var place = place(); var favorite = favorite(member, place, "첫 찜");
        assertThrows(DuplicateKeyException.class, () -> favorites.insert(favorite));
        assertEquals(1, favorites.findByMemberId(member.getMemberId()).size());
    }

    @Test
    @DisplayName("다른 회원은 같은 장소를 각각 찜할 수 있다")
    void differentMembersSamePlace() {
        var a = member(); var b = member(); var place = place();
        favorite(a, place, "A"); favorite(b, place, "B");
        assertTrue(favorites.exists(a.getMemberId(), place.getPlaceId()));
        assertTrue(favorites.exists(b.getMemberId(), place.getPlaceId()));
        assertEquals(1, favorites.findByMemberId(a.getMemberId()).size());
        assertEquals(1, favorites.findByMemberId(b.getMemberId()).size());
    }

    @Test
    @DisplayName("한 회원은 여러 장소를 찜할 수 있다")
    void oneMemberManyPlaces() {
        var member = member(); var a = place(); var b = place(); var c = place();
        favorite(member, a, "A"); favorite(member, b, "B"); favorite(member, c, "C");
        assertEquals(Set.of(a.getPlaceId(), b.getPlaceId(), c.getPlaceId()),
                Set.copyOf(favorites.findByMemberId(member.getMemberId()).stream().map(Favorite::getPlaceId).toList()));
    }

    @Test
    @DisplayName("존재하지 않는 회원이나 장소의 찜은 FK 제약으로 거부한다")
    void foreignKeys() {
        var member = member(); var place = place();
        Long missingMember = missingMemberId(); Long missingPlace = missingPlaceId();
        var invalidMember = new Favorite(); invalidMember.setMemberId(missingMember); invalidMember.setPlaceId(place.getPlaceId());
        var invalidPlace = new Favorite(); invalidPlace.setMemberId(member.getMemberId()); invalidPlace.setPlaceId(missingPlace);
        assertThrows(DataIntegrityViolationException.class, () -> favorites.insert(invalidMember));
        assertThrows(DataIntegrityViolationException.class, () -> favorites.insert(invalidPlace));
        assertTrue(favorites.findByMemberId(member.getMemberId()).isEmpty());
        assertTrue(favorites.findByMemberId(missingMember).isEmpty());
    }

    @Test
    @DisplayName("찜한 장소 JOIN은 회원별로 필터링하고 최신 찜 순서와 장소 컬럼을 매핑한다")
    void findPlacesByMemberId() {
        var a = member(); var b = member(); var older = place(); var newer = place(); var other = place();
        favorite(a, older, "이전 찜"); favorite(a, newer, "최근 찜"); favorite(b, other, "다른 회원");
        jdbc.update("UPDATE favorites SET created_at=? WHERE member_id=? AND place_id=?",
                Timestamp.valueOf(LocalDateTime.of(2026, 1, 1, 0, 0)), a.getMemberId(), older.getPlaceId());
        jdbc.update("UPDATE favorites SET created_at=? WHERE member_id=? AND place_id=?",
                Timestamp.valueOf(LocalDateTime.of(2026, 1, 2, 0, 0)), a.getMemberId(), newer.getPlaceId());
        var found = favorites.findPlacesByMemberId(a.getMemberId());
        assertEquals(List.of(newer.getPlaceId(), older.getPlaceId()), placeIds(found));
        assertEquals(List.of(newer.getPlaceId(), older.getPlaceId()), favorites.findByMemberId(a.getMemberId()).stream().map(Favorite::getPlaceId).toList());
        var joined = found.get(0);
        assertAll(() -> assertEquals(newer.getTitle(), joined.getTitle()),
                () -> assertEquals(newer.getAddress(), joined.getAddress()),
                () -> assertEquals(newer.getLatitude(), joined.getLatitude()),
                () -> assertEquals(newer.getLongitude(), joined.getLongitude()),
                () -> assertEquals(newer.getCategoryId(), joined.getCategoryId()),
                () -> assertEquals(newer.getRegionId(), joined.getRegionId()),
                () -> assertTrue(joined.getIsActive()), () -> assertNotNull(joined.getCreatedAt()));
    }

    @Test
    @DisplayName("회원 삭제 시 회원의 찜만 CASCADE로 삭제한다")
    void memberDeleteCascade() {
        var a = member(); var b = member(); var place = place();
        favorite(a, place, "A"); favorite(b, place, "B");
        assertEquals(1, members.deleteById(a.getMemberId()));
        assertTrue(favorites.findByMemberId(a.getMemberId()).isEmpty());
        assertTrue(favorites.exists(b.getMemberId(), place.getPlaceId()));
        assertNotNull(places.findById(place.getPlaceId()));
    }

    @Test
    @DisplayName("찜이 있는 장소는 RESTRICT로 삭제를 거부하고 찜 취소 후 삭제한다")
    void favoriteRestrictsPlaceDeletion() {
        var member = member(); var place = place(); favorite(member, place, "보존할 찜");
        assertThrows(DataIntegrityViolationException.class, () -> places.deleteById(place.getPlaceId()));
        assertNotNull(places.findById(place.getPlaceId()));
        assertEquals(1, favorites.delete(member.getMemberId(), place.getPlaceId()));
        assertEquals(1, places.deleteById(place.getPlaceId()));
        assertNull(places.findById(place.getPlaceId()));
    }
}
