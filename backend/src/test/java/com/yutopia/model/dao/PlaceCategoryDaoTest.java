package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlaceCategoryDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("전체 카테고리는 상위 분류와 하위 분류를 모두 조회한다")
    void findAll() {
        var food = category("음식점", null);
        var korean = category("한식", food.getCategoryId()); var western = category("양식", food.getCategoryId());
        var play = category("놀거리", null);
        var indoor = category("실내 액티비티", play.getCategoryId()); var outdoor = category("야외 액티비티", play.getCategoryId());
        var ids = categories.findAll().stream().filter(c -> c.getCategoryName().startsWith(prefix)).map(c -> c.getCategoryId()).toList();
        assertEquals(List.of(food.getCategoryId(), korean.getCategoryId(), western.getCategoryId(), play.getCategoryId(), indoor.getCategoryId(), outdoor.getCategoryId()), ids);
    }

    @Test
    @DisplayName("카테고리 ID로 이름과 부모 ID를 매핑한다")
    void findById() {
        var parent = category("음식점", null); var child = category("한식", parent.getCategoryId());
        var found = categories.findById(child.getCategoryId());
        assertEquals(child.getCategoryName(), found.getCategoryName());
        assertEquals(parent.getCategoryId(), found.getParentId());
    }

    @Test
    @DisplayName("하위 카테고리 조회는 다른 상위 분류를 제외한다")
    void findByParentId() {
        var food = category("음식점", null); var play = category("놀거리", null);
        var a = category("한식", food.getCategoryId()); var b = category("양식", food.getCategoryId());
        category("실내 액티비티", play.getCategoryId()); category("야외 액티비티", play.getCategoryId());
        assertEquals(List.of(a.getCategoryId(), b.getCategoryId()), categories.findByParentId(food.getCategoryId()).stream().map(c -> c.getCategoryId()).toList());
    }

    @Test
    @DisplayName("null 부모 ID는 최상위 카테고리만 조회한다")
    void findRoots() {
        var parent = category("음식점", null); category("한식", parent.getCategoryId());
        var found = categories.findByParentId(null);
        assertTrue(found.stream().allMatch(c -> c.getParentId() == null));
        assertTrue(found.stream().anyMatch(c -> parent.getCategoryId().equals(c.getCategoryId())));
    }

    @Test
    @DisplayName("존재하지 않는 카테고리는 null과 빈 하위 목록을 반환한다")
    void missingCategory() {
        var missing = category("없는 분류", null);
        jdbc.update("DELETE FROM place_categories WHERE category_id=?", missing.getCategoryId());
        assertNull(categories.findById(missing.getCategoryId()));
        assertTrue(categories.findByParentId(missing.getCategoryId()).isEmpty());
    }
}
