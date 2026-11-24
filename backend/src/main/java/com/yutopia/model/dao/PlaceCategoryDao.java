package com.yutopia.model.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.PlaceCategory;

@Mapper
public interface PlaceCategoryDao {
    List<PlaceCategory> findAll();

    PlaceCategory findById(@Param("categoryId") Long categoryId);

    /** A null parentId selects top-level categories. */
    List<PlaceCategory> findByParentId(@Param("parentId") Long parentId);
}
