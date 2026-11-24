package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RegionDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("전체 지역 조회는 시도와 시군구를 모두 포함한다")
    void findAll() {
        var seoul = region("서울특별시", null);
        var gangnam = region("강남구", seoul.getRegionId());
        var mapo = region("마포구", seoul.getRegionId());
        var busan = region("부산광역시", null);
        var haeundae = region("해운대구", busan.getRegionId());
        var ids = regions.findAll().stream().filter(r -> r.getRegionName().startsWith(prefix)).map(r -> r.getRegionId()).toList();
        assertEquals(List.of(seoul.getRegionId(), gangnam.getRegionId(), mapo.getRegionId(), busan.getRegionId(), haeundae.getRegionId()), ids);
    }

    @Test
    @DisplayName("지역 ID 조회는 부모 코드 이름 단계까지 매핑한다")
    void findById() {
        var parent = region("서울특별시", null);
        var child = region("강남구", parent.getRegionId());
        var found = regions.findById(child.getRegionId());
        assertAll(() -> assertEquals(child.getRegionName(), found.getRegionName()),
                () -> assertEquals(parent.getRegionId(), found.getParentId()),
                () -> assertEquals(child.getRegionCode(), found.getRegionCode()),
                () -> assertEquals(2, found.getRegionLevel()));
    }

    @Test
    @DisplayName("하위 지역 조회는 다른 시도의 시군구를 제외한다")
    void findByParentId() {
        var seoul = region("서울특별시", null); var busan = region("부산광역시", null);
        var a = region("강남구", seoul.getRegionId()); var b = region("마포구", seoul.getRegionId());
        region("해운대구", busan.getRegionId());
        assertEquals(List.of(a.getRegionId(), b.getRegionId()), regions.findByParentId(seoul.getRegionId()).stream().map(r -> r.getRegionId()).toList());
    }

    @Test
    @DisplayName("null 부모 ID는 최상위 지역만 조회한다")
    void findRoots() {
        var parent = region("서울특별시", null);
        region("강남구", parent.getRegionId());
        var found = regions.findByParentId(null);
        assertTrue(found.stream().allMatch(r -> r.getParentId() == null));
        assertTrue(found.stream().anyMatch(r -> parent.getRegionId().equals(r.getRegionId())));
    }

    @Test
    @DisplayName("존재하지 않는 지역은 null과 빈 하위 목록을 반환한다")
    void missingRegion() {
        var missing = region("없는 지역", null);
        jdbc.update("DELETE FROM regions WHERE region_id=?", missing.getRegionId());
        assertNull(regions.findById(missing.getRegionId()));
        assertTrue(regions.findByParentId(missing.getRegionId()).isEmpty());
    }
}
