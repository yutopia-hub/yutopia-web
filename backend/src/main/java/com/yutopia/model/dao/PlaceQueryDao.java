package com.yutopia.model.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.PlaceView;

/** 화면용 조회 전용 DAO (CRUD DAO 와 분리). */
@Mapper
public interface PlaceQueryDao {
    /** keyword(제목 부분 일치)·areaId(시도) 는 null 이면 조건에서 제외. */
    List<PlaceView> search(@Param("keyword") String keyword, @Param("areaId") Long areaId,
            @Param("offset") int offset, @Param("size") int size);

    PlaceView findDetail(@Param("externalId") String externalId);

    List<PlaceView> findFavorites(@Param("memberId") Long memberId);

    PlaceView findFavorite(@Param("memberId") Long memberId, @Param("externalId") String externalId);
}
