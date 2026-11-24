package com.yutopia.controller.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.yutopia.model.dto.Member;

/** 인증·회원 API 요청/응답 */
public final class AuthDtos {
    private AuthDtos() {
    }

    public record SignupRequest(String email, String password, String nickname) {
    }

    public record LoginRequest(String email, String password) {
    }

    public record PasswordResetRequest(String email) {
    }

    public record PasswordResetConfirmRequest(String token, String password) {
    }

    public record UpdateMemberRequest(String nickname) {
    }

    public record DeleteMemberRequest(String password) {
    }

    /** 프론트 authStore 가 쓰는 사용자 형태: { id, email, nickname } */
    public record UserResponse(String id, String email, String nickname) {
        public static UserResponse from(Member member) {
            return new UserResponse(String.valueOf(member.getMemberId()), member.getEmail(), member.getNickname());
        }
    }

    public record AuthResponse(UserResponse user, String token) {
    }

    /** 메일 발송 대신 개발 모드에서만 resetToken 을 내려 준다. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PasswordResetResponse(String resetToken) {
    }
}
