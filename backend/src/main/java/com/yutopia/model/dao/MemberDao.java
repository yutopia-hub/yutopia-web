package com.yutopia.model.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.yutopia.model.dto.Member;

@Mapper
public interface MemberDao {
    int insert(Member member);

    Member findById(@Param("memberId") Long memberId);

    Member findByEmail(@Param("email") String email);

    /** Replaces email, nickname, passwordHash and role; timestamps are database managed. */
    int update(Member member);

    int deleteById(@Param("memberId") Long memberId);
}
