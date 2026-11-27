package com.yutopia.service;

import java.time.Instant;
import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.YutoChatDtos.Conversation;
import com.yutopia.resource.YutoChatDtos.Reply;
import com.yutopia.resource.YutoChatDtos.Turn;
import com.yutopia.resource.YutoCourse;

@Service
@Profile("ai")
public class YutoChatService {
    private final YutoConversationStore store;
    private final YutoChatEngine engine;

    public YutoChatService(YutoConversationStore store, YutoChatEngine engine) {
        this.store = store; this.engine = engine;
    }

    public Conversation create(long owner, YutoCourse course) { return store.create(owner, course); }
    public Conversation read(long owner, String id) { return store.read(owner, id); }
    public void delete(long owner, String id) { store.delete(owner, id); }

    public Reply send(long owner, String id, String message) {
        if (message == null || message.isBlank() || message.length() > 2000) {
            throw ApiException.badRequest("질문은 1~2000자로 입력해 주세요.");
        }
        return store.access(owner, id, state -> {
            YutoChatEngine.Outcome outcome;
            try {
                outcome = engine.answer(state.course, List.copyOf(state.turns), state.candidates, message.trim());
            } catch (ApiException known) { throw known; }
            catch (RuntimeException error) {
                // Do not leak upstream model errors, request payloads, keys or partial histories.
                throw new ApiException(HttpStatus.BAD_GATEWAY, "유토 응답 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
            }
            store.commit(state, new Turn(message.trim(), outcome.answer(), Instant.now(), outcome.evidence()), outcome.candidates());
            return new Reply(id, outcome.answer(), outcome.evidence(), store.expiresAt(state));
        });
    }
}
