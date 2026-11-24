package com.yutopia.security;

import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.yutopia.exception.ApiException;
import com.yutopia.model.dto.Member;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/** {@code Authorization: Bearer <token>} 을 검증해 요청 속성에 회원을 넣는다. */
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {
    public static final String ATTRIBUTE = "yutopia.loginMember";
    private final TokenProvider tokenProvider;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) return true; // CORS preflight
        String header = request.getHeader("Authorization");
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : null;
        Member member = tokenProvider.verify(token);
        if (member == null) throw ApiException.unauthorized("로그인이 필요합니다. 다시 로그인해 주세요.");
        request.setAttribute(ATTRIBUTE, member);
        return true;
    }
}
