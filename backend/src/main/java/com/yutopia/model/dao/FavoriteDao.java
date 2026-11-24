package com.yutopia.model.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.Favorite;
import com.yutopia.model.dto.Place;

@Mapper
public interface FavoriteDao {
    int insert(Favorite favorite);

    int delete(@Param("memberId") Long memberId, @Param("placeId") Long placeId);

    int updateMemo(@Param("memberId") Long memberId, @Param("placeId") Long placeId, @Param("memo") String memo);

    List<Favorite> findByMemberId(@Param("memberId") Long memberId);

    List<Place> findPlacesByMemberId(@Param("memberId") Long memberId);

    boolean exists(@Param("memberId") Long memberId, @Param("placeId") Long placeId);
}
