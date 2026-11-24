package com.yutopia.model.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.PlaceDetail;

@Mapper
public interface PlaceDetailDao {
    int insert(PlaceDetail detail);

    PlaceDetail findByPlaceId(@Param("placeId") Long placeId);

    /** Replaces all detail columns, including nullable columns. */
    int update(PlaceDetail detail);

    int deleteByPlaceId(@Param("placeId") Long placeId);
}
