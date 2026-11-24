package com.yutopia.model.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.Place;

@Mapper
public interface PlaceDao {
    int insert(Place place);

    Place findById(@Param("placeId") Long placeId);

    /** (provider, external_id) 는 UNIQUE 이므로 최대 1건. */
    Place findByExternalId(@Param("provider") String provider, @Param("externalId") String externalId);

    List<Place> findAll();

    List<Place> findByRegionId(@Param("regionId") Long regionId);

    List<Place> findByCategoryId(@Param("categoryId") Long categoryId);

    List<Place> searchByTitle(@Param("keyword") String keyword);

    /** Replaces mutable columns, including nullable columns; timestamps are database managed. */
    int update(Place place);

    /** The schema restricts deletion of places referenced by favorites. */
    int deleteById(@Param("placeId") Long placeId);
}
