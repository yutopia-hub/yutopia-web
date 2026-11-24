package com.yutopia.service;

import java.util.Locale;
import java.util.regex.Pattern;

import com.yutopia.exception.ApiException;

/** 프론트 utils/validators.js 와 같은 규칙을 서버에서도 강제한다. */
final class MemberRules {
    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$");
    private static final Pattern PASSWORD = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d)\\S{8,64}$");
    private static final Pattern NICKNAME = Pattern.compile("^[가-힣A-Za-z0-9_-]{2,30}$");

    private MemberRules() {
    }

    static String email(String value) {
        String email = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL.matcher(email).matches() || email.contains("..")) {
            throw ApiException.badRequest("올바른 이메일 형식을 입력해 주세요.");
        }
        return email;
    }

    static String password(String value) {
        if (value == null || !PASSWORD.matcher(value).matches()) {
            throw ApiException.badRequest("비밀번호는 공백 없이 영문과 숫자를 포함한 8~64자여야 합니다.");
        }
        return value;
    }

    static String nickname(String value) {
        String nickname = value == null ? "" : value.trim();
        if (!NICKNAME.matcher(nickname).matches()) {
            throw ApiException.badRequest("닉네임은 한글·영문·숫자·_·-로 2~30자 입력해 주세요.");
        }
        return nickname;
    }

    static void required(String value, String message) {
        if (value == null || value.isBlank()) throw ApiException.badRequest(message);
    }
}
