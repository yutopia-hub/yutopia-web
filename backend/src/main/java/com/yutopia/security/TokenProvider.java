package com.yutopia.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.yutopia.model.dao.MemberDao;
import com.yutopia.model.dto.Member;

/**
 * 서버 저장소가 필요 없는 HMAC 서명 토큰: {@code base64(memberId.만료초).base64(서명)}.
 * 서명에 회원의 비밀번호 해시를 섞어서, 비밀번호 변경·탈퇴 시 기존 토큰이 자동으로 무효가 된다.
 */
@Component
public class TokenProvider {
    private static final Base64.Encoder ENC = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DEC = Base64.getUrlDecoder();

    private final byte[] secret;
    private final Duration ttl;
    private final MemberDao memberDao;

    public TokenProvider(@Value("${yutopia.auth.token-secret}") String secret,
            @Value("${yutopia.auth.token-ttl-hours:168}") long ttlHours, MemberDao memberDao) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("yutopia.auth.token-secret must be at least 32 characters");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttl = Duration.ofHours(ttlHours);
        this.memberDao = memberDao;
    }

    public String issue(Member member) {
        long expires = Instant.now().plus(ttl).getEpochSecond();
        String payload = member.getMemberId() + "." + expires;
        return ENC.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + "." + sign(payload, member);
    }

    /** 유효하면 회원, 아니면 null. */
    public Member verify(String token) {
        if (token == null || token.isBlank()) return null;
        String[] parts = token.split("\\.");
        if (parts.length != 2) return null;
        try {
            String payload = new String(DEC.decode(parts[0]), StandardCharsets.UTF_8);
            String[] fields = payload.split("\\.");
            if (fields.length != 2) return null;
            long memberId = Long.parseLong(fields[0]);
            long expires = Long.parseLong(fields[1]);
            if (Instant.now().getEpochSecond() >= expires) return null;
            Member member = memberDao.findById(memberId);
            if (member == null) return null;
            byte[] expected = sign(payload, member).getBytes(StandardCharsets.US_ASCII);
            return MessageDigest.isEqual(expected, parts[1].getBytes(StandardCharsets.US_ASCII)) ? member : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String sign(String payload, Member member) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            mac.update(payload.getBytes(StandardCharsets.UTF_8));
            mac.update((byte) 0);
            mac.update(member.getPasswordHash().getBytes(StandardCharsets.UTF_8));
            return ENC.encodeToString(mac.doFinal());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}
