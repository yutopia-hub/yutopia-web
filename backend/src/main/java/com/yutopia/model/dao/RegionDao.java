package com.yutopia.model.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.Region;

@Mapper
public interface RegionDao {
    List<Region> findAll();

    Region findById(@Param("regionId") Long regionId);

    /** A null parentId selects top-level regions. */
    List<Region> findByParentId(@Param("parentId") Long parentId);
}
