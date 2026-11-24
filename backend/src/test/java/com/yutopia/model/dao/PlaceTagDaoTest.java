package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

class PlaceTagDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("장소 태그를 등록하고 장소 ID와 태그를 조회한다")
    void insert() {
        var place = place(); var tag = tag(place, "테스트태그");
        assertEquals(1, tags.insert(tag));
        var found = tags.findByPlaceId(place.getPlaceId());
        assertEquals(1, found.size());
        assertEquals(place.getPlaceId(), found.get(0).getPlaceId());
        assertEquals("테스트태그", found.get(0).getTag());
    }

    @Test
    @DisplayName("태그 조회에 다른 장소의 태그가 섞이지 않는다")
    void findByPlaceId() {
        var a = place(); var b = place();
        tags.insert(tag(a, "가족")); tags.insert(tag(a, "야외")); tags.insert(tag(b, "실내"));
        assertEquals(List.of("가족", "야외"), tags.findByPlaceId(a.getPlaceId()).stream().map(t -> t.getTag()).toList());
    }

    @Test
    @DisplayName("복합 키로 태그를 삭제하면 다른 태그와 다른 장소의 같은 태그가 유지된다")
    void delete() {
        var a = place(); var b = place();
        tags.insert(tag(a, "가족")); tags.insert(tag(a, "야외")); tags.insert(tag(b, "가족"));
        assertEquals(1, tags.delete(a.getPlaceId(), "가족"));
        assertEquals(List.of("야외"), tags.findByPlaceId(a.getPlaceId()).stream().map(t -> t.getTag()).toList());
        assertEquals(List.of("가족"), tags.findByPlaceId(b.getPlaceId()).stream().map(t -> t.getTag()).toList());
        assertEquals(0, tags.delete(a.getPlaceId(), "가족"));
    }

    @Test
    @DisplayName("같은 장소의 같은 태그는 복합 PK로 중복을 거부한다")
    void duplicateTag() {
        var place = place(); tags.insert(tag(place, "가족"));
        assertThrows(DuplicateKeyException.class, () -> tags.insert(tag(place, "가족")));
    }

    @Test
    @DisplayName("서로 다른 장소에는 같은 이름의 태그를 등록할 수 있다")
    void sameTagOnDifferentPlaces() {
        var a = place(); var b = place();
        assertEquals(1, tags.insert(tag(a, "가족")));
        assertEquals(1, tags.insert(tag(b, "가족")));
        assertEquals(1, tags.findByPlaceId(a.getPlaceId()).size());
        assertEquals(1, tags.findByPlaceId(b.getPlaceId()).size());
    }

    @Test
    @DisplayName("존재하지 않는 장소의 태그는 빈 목록이다")
    void missingPlaceTags() {
        assertTrue(tags.findByPlaceId(missingPlaceId()).isEmpty());
    }
}
