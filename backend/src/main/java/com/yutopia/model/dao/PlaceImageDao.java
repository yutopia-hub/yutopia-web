package com.yutopia.model.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.PlaceImage;

@Mapper
public interface PlaceImageDao {
    int insert(PlaceImage image);

    List<PlaceImage> findByPlaceId(@Param("placeId") Long placeId);

    int deleteById(@Param("imageId") Long imageId);
}
