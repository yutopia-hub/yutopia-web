package com.yutopia.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yutopia.controller.dto.AuthDtos.UserResponse;
import com.yutopia.exception.ApiException;
import com.yutopia.model.dao.MemberDao;
import com.yutopia.model.dto.Member;
import com.yutopia.security.PasswordHasher;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MemberService {
    private final MemberDao memberDao;
    private final PasswordHasher passwordHasher;

    @Transactional
    public UserResponse updateNickname(Member member, String rawNickname) {
        member.setNickname(MemberRules.nickname(rawNickname));
        memberDao.update(member);
        return UserResponse.from(member);
    }

    /** favorites 는 FK ON DELETE CASCADE 로 함께 삭제된다. */
    @Transactional
    public void delete(Member member, String password) {
        MemberRules.required(password, "비밀번호를 입력해 주세요.");
        if (!passwordHasher.matches(password, member.getPasswordHash())) {
            throw ApiException.badRequest("비밀번호가 올바르지 않습니다.");
        }
        memberDao.deleteById(member.getMemberId());
    }
}
