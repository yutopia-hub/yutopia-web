package com.yutopia.model.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.PlaceTag;

@Mapper
public interface PlaceTagDao {
    int insert(PlaceTag tag);

    List<PlaceTag> findByPlaceId(@Param("placeId") Long placeId);

    int delete(@Param("placeId") Long placeId, @Param("tag") String tag);
}
