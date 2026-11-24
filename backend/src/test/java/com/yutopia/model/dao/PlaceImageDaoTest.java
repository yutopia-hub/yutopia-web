package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;

class PlaceImageDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("이미지 등록 시 생성 키와 기본 순서 및 문자열 컬럼을 매핑한다")
    void insert() {
        var place = place(); var image = image(place, null);
        assertEquals(1, images.insert(image));
        assertNotNull(image.getImageId());
        var found = images.findByPlaceId(place.getPlaceId()).get(0);
        assertAll(() -> assertEquals(image.getImageId(), found.getImageId()),
                () -> assertEquals(place.getPlaceId(), found.getPlaceId()),
                () -> assertEquals(image.getImageUrl(), found.getImageUrl()),
                () -> assertEquals(image.getThumbnailUrl(), found.getThumbnailUrl()),
                () -> assertEquals(image.getCaption(), found.getCaption()),
                () -> assertEquals(image.getSource(), found.getSource()),
                () -> assertEquals(image.getLicenseType(), found.getLicenseType()),
                () -> assertEquals(1, found.getSortOrder()));
    }

    @Test
    @DisplayName("이미지 목록은 등록 순서가 아닌 sort_order 순으로 정렬된다")
    void findByPlaceIdInDisplayOrder() {
        var place = place();
        var third = image(place, 3); var first = image(place, 1); var second = image(place, 2);
        images.insert(third); images.insert(first); images.insert(second);
        assertEquals(List.of(first.getImageId(), second.getImageId(), third.getImageId()),
                images.findByPlaceId(place.getPlaceId()).stream().map(i -> i.getImageId()).toList());
    }

    @Test
    @DisplayName("장소별 이미지 조회에 다른 장소의 이미지가 섞이지 않는다")
    void isolatePlaces() {
        var a = place(); var b = place(); var mine = image(a, 1);
        images.insert(mine); images.insert(image(b, 1));
        assertEquals(List.of(mine.getImageId()), images.findByPlaceId(a.getPlaceId()).stream().map(i -> i.getImageId()).toList());
    }

    @Test
    @DisplayName("이미지 삭제는 지정한 이미지에만 적용된다")
    void deleteById() {
        var place = place(); var a = image(place, 1); var b = image(place, 2);
        images.insert(a); images.insert(b);
        assertEquals(1, images.deleteById(a.getImageId()));
        assertEquals(List.of(b.getImageId()), images.findByPlaceId(place.getPlaceId()).stream().map(i -> i.getImageId()).toList());
        assertEquals(0, images.deleteById(a.getImageId()));
    }

    @Test
    @DisplayName("같은 장소의 이미지 표시 순서 중복을 거부한다")
    void duplicateSortOrder() {
        var place = place(); images.insert(image(place, 1));
        assertThrows(DuplicateKeyException.class, () -> images.insert(image(place, 1)));
    }

    @Test
    @DisplayName("존재하지 않는 장소의 이미지 목록은 비어 있다")
    void missingPlaceImages() {
        assertTrue(images.findByPlaceId(missingPlaceId()).isEmpty());
    }

    @Test
    @DisplayName("이미지의 FK와 양수 정렬 순서 CHECK를 검증한다")
    void constraints() {
        var place = place(); var invalid = image(place, 1); invalid.setPlaceId(missingPlaceId());
        assertThrows(DataIntegrityViolationException.class, () -> images.insert(invalid));
        assertCheckViolation("ck_images_sort", () -> images.insert(image(place, 0)));
    }
}
