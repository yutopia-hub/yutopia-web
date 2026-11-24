package com.yutopia.model.dao;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

class MemberDaoTest extends DaoTestSupport {
    @Test
    @DisplayName("회원 등록 시 생성 키와 기본 역할 및 생성 시각을 매핑한다")
    void insert() {
        var member = newMember();
        assertEquals(1, members.insert(member));
        assertNotNull(member.getMemberId());
        var stored = members.findById(member.getMemberId());
        assertAll(() -> assertEquals(member.getEmail(), stored.getEmail()),
                () -> assertEquals(member.getNickname(), stored.getNickname()),
                () -> assertEquals(PASSWORD_HASH, stored.getPasswordHash()),
                () -> assertEquals("USER", stored.getRole()),
                () -> assertNotNull(stored.getCreatedAt()), () -> assertNotNull(stored.getUpdatedAt()));
    }

    @Test
    @DisplayName("회원 ID로 다른 회원과 구분해 조회한다")
    void findById() {
        var first = member();
        var second = member();
        var found = members.findById(first.getMemberId());
        assertEquals(first.getEmail(), found.getEmail());
        assertNotEquals(second.getMemberId(), found.getMemberId());
    }

    @Test
    @DisplayName("이메일로 정확한 회원을 조회한다")
    void findByEmail() {
        var member = member();
        member();
        assertEquals(member.getMemberId(), members.findByEmail(member.getEmail()).getMemberId());
        assertNull(members.findByEmail(prefix + "-absent@example.invalid"));
    }

    @Test
    @DisplayName("회원 수정 후 이메일 닉네임 비밀번호 해시와 역할이 변경된다")
    void update() {
        var member = member();
        var createdAt = members.findById(member.getMemberId()).getCreatedAt();
        member.setEmail(prefix + "-changed@example.invalid");
        member.setNickname("변경 회원");
        member.setPasswordHash(PASSWORD_HASH.replace("$10$", "$12$"));
        member.setRole("ADMIN");
        assertEquals(1, members.update(member));
        var found = members.findById(member.getMemberId());
        assertAll(() -> assertEquals(member.getEmail(), found.getEmail()),
                () -> assertEquals("변경 회원", found.getNickname()),
                () -> assertEquals(member.getPasswordHash(), found.getPasswordHash()),
                () -> assertEquals("ADMIN", found.getRole()),
                () -> assertEquals(createdAt, found.getCreatedAt()));
    }

    @Test
    @DisplayName("회원 삭제 후 조회되지 않고 재삭제 영향 행 수는 0이다")
    void deleteById() {
        var member = member();
        assertEquals(1, members.deleteById(member.getMemberId()));
        assertNull(members.findById(member.getMemberId()));
        assertEquals(0, members.deleteById(member.getMemberId()));
    }

    @Test
    @DisplayName("중복 이메일은 UNIQUE 제약으로 거부한다")
    void duplicateEmail() {
        var member = member();
        var duplicate = newMember();
        duplicate.setEmail(member.getEmail());
        assertThrows(DuplicateKeyException.class, () -> members.insert(duplicate));
    }

    @Test
    @DisplayName("존재하지 않는 회원 ID는 null을 반환한다")
    void missingMember() {
        assertNull(members.findById(missingMemberId()));
    }
}
