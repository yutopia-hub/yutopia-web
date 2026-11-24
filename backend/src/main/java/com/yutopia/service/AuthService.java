package com.yutopia.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yutopia.controller.dto.AuthDtos.AuthResponse;
import com.yutopia.controller.dto.AuthDtos.PasswordResetResponse;
import com.yutopia.controller.dto.AuthDtos.UserResponse;
import com.yutopia.exception.ApiException;
import com.yutopia.model.dao.MemberDao;
import com.yutopia.model.dto.Member;
import com.yutopia.security.PasswordHasher;
import com.yutopia.security.TokenProvider;

@Service
public class AuthService {
    private static final Duration RESET_TTL = Duration.ofMinutes(15);

    private final MemberDao memberDao;
    private final PasswordHasher passwordHasher;
    private final TokenProvider tokenProvider;
    private final boolean exposeResetToken;
    private final SecureRandom random = new SecureRandom();
    /** 재설정 토큰 → (회원, 만료). 단일 인스턴스 기준 메모리 저장, 재시작 시 사라진다. */
    private final Map<String, ResetTicket> resetTickets = new ConcurrentHashMap<>();

    private record ResetTicket(Long memberId, Instant expiresAt) {
    }

    public AuthService(MemberDao memberDao, PasswordHasher passwordHasher, TokenProvider tokenProvider,
            @Value("${yutopia.auth.expose-reset-token:false}") boolean exposeResetToken) {
        this.memberDao = memberDao;
        this.passwordHasher = passwordHasher;
        this.tokenProvider = tokenProvider;
        this.exposeResetToken = exposeResetToken;
    }

    @Transactional
    public AuthResponse signup(String rawEmail, String rawPassword, String rawNickname) {
        String email = MemberRules.email(rawEmail);
        String password = MemberRules.password(rawPassword);
        String nickname = MemberRules.nickname(rawNickname);
        if (memberDao.findByEmail(email) != null) throw ApiException.conflict("이미 가입된 이메일입니다.");

        Member member = new Member();
        member.setEmail(email);
        member.setNickname(nickname);
        member.setPasswordHash(passwordHasher.hash(password));
        member.setRole("USER");
        memberDao.insert(member);
        return session(member);
    }

    public AuthResponse login(String rawEmail, String password) {
        MemberRules.required(rawEmail, "이메일을 입력해 주세요.");
        MemberRules.required(password, "비밀번호를 입력해 주세요.");
        Member member = memberDao.findByEmail(rawEmail.trim().toLowerCase());
        if (member == null || !passwordHasher.matches(password, member.getPasswordHash())) {
            throw ApiException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        return session(member);
    }

    /** 가입 여부를 노출하지 않도록 없는 이메일도 같은 응답을 준다. */
    public PasswordResetResponse requestPasswordReset(String rawEmail) {
        String email = MemberRules.email(rawEmail);
        Member member = memberDao.findByEmail(email);
        if (member == null) return new PasswordResetResponse(null);
        purgeExpired();
        resetTickets.values().removeIf(ticket -> ticket.memberId().equals(member.getMemberId()));
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        resetTickets.put(token, new ResetTicket(member.getMemberId(), Instant.now().plus(RESET_TTL)));
        return new PasswordResetResponse(exposeResetToken ? token : null);
    }

    @Transactional
    public void confirmPasswordReset(String token, String rawPassword) {
        String password = MemberRules.password(rawPassword);
        ResetTicket ticket = token == null ? null : resetTickets.remove(token);
        Member member = ticket == null || ticket.expiresAt().isBefore(Instant.now()) ? null
                : memberDao.findById(ticket.memberId());
        if (member == null) throw ApiException.badRequest("재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요.");
        member.setPasswordHash(passwordHasher.hash(password)); // 기존 토큰은 서명 불일치로 무효화
        memberDao.update(member);
    }

    private AuthResponse session(Member member) {
        return new AuthResponse(UserResponse.from(member), tokenProvider.issue(member));
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        resetTickets.values().removeIf(ticket -> ticket.expiresAt().isBefore(now));
    }
}
