package com.yutopia.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Function;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.YutoCourse;
import com.yutopia.resource.YutoChatDtos.Conversation;
import com.yutopia.resource.YutoChatDtos.Turn;

/** Single-instance memory store. No model/provider call holds the global creation lock. */
@Component
public class YutoConversationStore {
    static final Duration TTL = Duration.ofMinutes(30);
    private final ConcurrentHashMap<String, State> sessions = new ConcurrentHashMap<>();
    private final Clock clock;

    public YutoConversationStore() { this(Clock.systemUTC()); }
    YutoConversationStore(Clock clock) { this.clock = clock; }

    public synchronized Conversation create(long owner, YutoCourse course) {
        if (owner <= 0) throw ApiException.unauthorized("로그인이 필요합니다.");
        if (course == null) throw ApiException.badRequest("추천된 코스 정보가 필요합니다.");
        purgeExpired();
        if (sessions.size() >= 1000 || sessions.values().stream().filter(s -> s.owner == owner).count() >= 5) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "진행 중인 유토 대화를 닫은 뒤 새 대화를 시작해 주세요.");
        }
        var state = new State(UUID.randomUUID().toString(), owner, course, clock.instant());
        sessions.put(state.id, state);
        return snapshot(state);
    }

    public <T> T access(long owner, String id, Function<State, T> action) {
        State state = sessions.get(id == null ? "" : id);
        if (state == null || state.owner != owner) throw missing();
        if (!state.lock.tryLock()) throw ApiException.conflict("이 코스의 이전 답변을 생성 중입니다. 잠시 후 다시 시도해 주세요.");
        try {
            if (sessions.get(id) != state || !state.updatedAt.plus(TTL).isAfter(clock.instant())) {
                sessions.remove(id, state);
                throw missing();
            }
            return action.apply(state);
        } finally { state.lock.unlock(); }
    }

    public Conversation read(long owner, String id) { return access(owner, id, this::snapshot); }
    public void delete(long owner, String id) { access(owner, id, s -> { sessions.remove(id, s); return null; }); }

    void commit(State state, Turn turn, LinkedHashMap<String, YutoCourseTools.Candidate> candidates) {
        state.turns.add(turn);
        if (state.turns.size() > 20) state.turns.remove(0);
        state.candidates = new LinkedHashMap<>(candidates);
        state.updatedAt = clock.instant();
    }

    Instant expiresAt(State state) { return state.updatedAt.plus(TTL); }

    private Conversation snapshot(State state) {
        return new Conversation(state.id, state.course, List.copyOf(state.turns), expiresAt(state));
    }

    private void purgeExpired() {
        for (State state : sessions.values()) {
            if (state.lock.tryLock()) {
                try {
                    if (!state.updatedAt.plus(TTL).isAfter(clock.instant())) sessions.remove(state.id, state);
                } finally { state.lock.unlock(); }
            }
        }
    }

    private static ApiException missing() { return ApiException.notFound("유토 대화가 없거나 만료되었습니다. 코스에서 새 대화를 시작해 주세요."); }

    static final class State {
        final String id;
        final long owner;
        final YutoCourse course;
        final ReentrantLock lock = new ReentrantLock();
        final List<Turn> turns = new ArrayList<>();
        LinkedHashMap<String, YutoCourseTools.Candidate> candidates = new LinkedHashMap<>();
        volatile Instant updatedAt;

        State(String id, long owner, YutoCourse course, Instant now) {
            this.id = id; this.owner = owner; this.course = course; this.updatedAt = now;
        }
    }
}
