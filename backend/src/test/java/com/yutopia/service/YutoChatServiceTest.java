package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.AssistantMessage.ToolCall;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.http.HttpStatus;

import com.yutopia.exception.ApiException;
import com.yutopia.resource.YutoCourse;

class YutoChatServiceTest {
    private static final String SEGMENT = "\"startStopId\":\"a\",\"endStopId\":\"b\",\"avoidStairs\":false";

    @Test
    void recordsSuccessfulTurnAndIncludesOnlyItsOwnCourseHistory() {
        var providers = new YutoTestSupport();
        var store = new YutoConversationStore();
        List<List<Message>> prompts = new ArrayList<>();
        var service = providers.service(store, (messages, tools) -> {
            prompts.add(messages);
            assertEquals(3, tools.size());
            return new AssistantMessage("어느 구간이 궁금한가요?");
        });
        var first = service.create(1, YutoTestSupport.course("first"));
        var second = service.create(1, YutoTestSupport.course("second"));
        service.send(1, first.conversationId(), "첫 질문");
        service.send(1, first.conversationId(), "이어서 질문");
        assertTrue(prompts.get(1).stream().anyMatch(m -> "첫 질문".equals(m.getText())));
        service.send(1, second.conversationId(), "다른 코스 질문");
        assertFalse(prompts.get(2).stream().anyMatch(m -> "첫 질문".equals(m.getText())));
        assertEquals(2, service.read(1, first.conversationId()).turns().size());
        assertEquals(0, providers.walking.directCalls);
    }

    @Test
    void executesSearchAndDetourWithServerOwnedCoordinatesAndEvidence() {
        var providers = new YutoTestSupport();
        var store = new YutoConversationStore();
        AtomicInteger step = new AtomicInteger();
        var service = providers.service(store, (messages, tools) -> switch (step.getAndIncrement()) {
            case 0 -> call("s", "searchPlacesAlongRoute", "{" + SEGMENT + ",\"kind\":\"RESTAURANT\"}");
            case 1 -> {
                assertInstanceOf(ToolResponseMessage.class, messages.get(messages.size() - 1));
                yield call("d", "compareDetourTime", "{" + SEGMENT + ",\"placeId\":\"kakao:food\"}");
            }
            default -> new AssistantMessage("식당을 들르면 이동 시간이 약 3분 추가될 것으로 예상돼요. 식사 시간은 별도예요.");
        });
        var session = service.create(1, YutoTestSupport.course("course"));
        var reply = service.send(1, session.conversationId(), "가는 길 식당을 들르면 얼마나 더 걸려?");
        assertEquals(2, reply.evidence().size());
        assertTrue(reply.evidence().stream().allMatch(e -> e.success()));
        assertEquals(180, reply.evidence().get(1).result().path("timeDifferenceSeconds").asInt());
        assertNotNull(providers.search.receivedPath);
        assertEquals(127.0, providers.search.receivedPath.get(0).lng());
        assertEquals(2, providers.walking.directCalls); // Search route + fresh comparison baseline.
        assertEquals(1, providers.walking.viaCalls);
    }

    @Test
    void previousSearchResultsRemainUsableWithinSameConversationOnly() {
        var providers = new YutoTestSupport();
        AtomicInteger step = new AtomicInteger();
        var service = providers.service(new YutoConversationStore(), (messages, tools) -> switch (step.getAndIncrement()) {
            case 0 -> call("s", "searchPlacesAlongRoute", "{" + SEGMENT + ",\"kind\":\"RESTAURANT\"}");
            case 2, 4 -> call("d" + step.get(), "compareDetourTime", "{" + SEGMENT + ",\"placeId\":\"kakao:food\"}");
            default -> new AssistantMessage("조회 결과를 안내합니다.");
        });
        var first = service.create(1, YutoTestSupport.course("one"));
        var second = service.create(1, YutoTestSupport.course("two"));
        service.send(1, first.conversationId(), "식당 찾아줘");
        assertTrue(service.send(1, first.conversationId(), "그 식당 들르면?").evidence().get(0).success());
        assertFalse(service.send(1, second.conversationId(), "그 식당 들르면?").evidence().get(0).success());
        assertEquals(1, providers.walking.viaCalls);
    }

    @Test
    void rejectsInventedCourseIdsWithoutCallingProvider() {
        var providers = new YutoTestSupport();
        AtomicInteger step = new AtomicInteger();
        var service = providers.service(new YutoConversationStore(), (messages, tools) -> step.getAndIncrement() == 0
                ? call("x", "getWalkingRoute", "{\"startStopId\":\"unknown\",\"endStopId\":\"b\",\"avoidStairs\":false}")
                : new AssistantMessage("현재 코스의 구간을 선택해 주세요."));
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        var reply = service.send(1, id, "엉뚱한 곳으로 가줘");
        assertFalse(reply.evidence().get(0).success());
        assertEquals(0, providers.walking.directCalls);
    }

    @Test
    void rejectsUnknownToolAndRollsBackHistory() {
        var providers = new YutoTestSupport();
        var service = providers.service(new YutoConversationStore(), (messages, tools) -> call("x", "runShell", "{}"));
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        assertEquals(HttpStatus.BAD_GATEWAY, assertThrows(ApiException.class, () -> service.send(1, id, "질문")).getStatus());
        assertTrue(service.read(1, id).turns().isEmpty());
        assertEquals(0, providers.walking.directCalls);
    }

    @Test
    void modelFailureDoesNotPersistPartialHistoryOrLeakSecrets() {
        var service = new YutoTestSupport().service(new YutoConversationStore(), (messages, tools) -> {
            throw new IllegalStateException("secret API key upstream-body");
        });
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        var error = assertThrows(ApiException.class, () -> service.send(1, id, "질문"));
        assertFalse(error.getMessage().contains("secret"));
        assertNull(error.getCause());
        assertTrue(service.read(1, id).turns().isEmpty());
    }

    @Test
    void failedFinalAnswerDoesNotCommitNewSearchCandidates() {
        var providers = new YutoTestSupport();
        AtomicInteger step = new AtomicInteger();
        var service = providers.service(new YutoConversationStore(), (messages, tools) -> switch (step.getAndIncrement()) {
            case 0 -> call("search", "searchPlacesAlongRoute", "{" + SEGMENT + ",\"kind\":\"RESTAURANT\"}");
            case 1 -> throw new IllegalStateException("upstream failure");
            case 2 -> call("detour", "compareDetourTime", "{" + SEGMENT + ",\"placeId\":\"kakao:food\"}");
            default -> new AssistantMessage("식당을 먼저 검색해 주세요.");
        });
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        assertThrows(ApiException.class, () -> service.send(1, id, "식당 찾아줘"));
        assertTrue(service.read(1, id).turns().isEmpty());
        var next = service.send(1, id, "그 식당 들르면?");
        assertFalse(next.evidence().get(0).success());
        assertEquals(0, providers.walking.viaCalls);
    }

    @Test
    void repeatedToolRequestsAreBoundedAndDoNotRefetchCachedRoute() {
        var providers = new YutoTestSupport();
        AtomicInteger step = new AtomicInteger();
        var service = providers.service(new YutoConversationStore(), (messages, tools) ->
                call("r" + step.incrementAndGet(), "getWalkingRoute", "{" + SEGMENT + "}"));
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, assertThrows(ApiException.class, () -> service.send(1, id, "계속 조회")).getStatus());
        assertEquals(4, step.get());
        assertEquals(1, providers.walking.directCalls);
        assertTrue(service.read(1, id).turns().isEmpty());
    }

    @Test
    void validatesMessageAndPreventsCrossMemberAccessBeforeModelCall() {
        AtomicInteger calls = new AtomicInteger();
        var service = new YutoTestSupport().service(new YutoConversationStore(), (messages, tools) -> {
            calls.incrementAndGet(); return new AssistantMessage("답변");
        });
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        assertThrows(ApiException.class, () -> service.send(1, id, " "));
        assertThrows(ApiException.class, () -> service.send(1, id, "x".repeat(2001)));
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.send(2, id, "다른 회원")).getStatus());
        assertThrows(ApiException.class, () -> service.read(2, id));
        assertThrows(ApiException.class, () -> service.delete(2, id));
        assertEquals(0, calls.get());
    }

    @Test
    void concurrentMessagesInSameConversationReturnConflict() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var service = new YutoTestSupport().service(new YutoConversationStore(), (messages, tools) -> {
            entered.countDown();
            try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("test timeout"); }
            catch (InterruptedException e) { throw new IllegalStateException(e); }
            return new AssistantMessage("완료");
        });
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        try (var executor = Executors.newSingleThreadExecutor()) {
            var first = executor.submit(() -> service.send(1, id, "첫 질문"));
            try {
                assertTrue(entered.await(5, TimeUnit.SECONDS));
                assertEquals(HttpStatus.CONFLICT, assertThrows(ApiException.class, () -> service.send(1, id, "중복 질문")).getStatus());
                assertThrows(ApiException.class, () -> service.delete(1, id));
            } finally { release.countDown(); }
            assertEquals("완료", first.get(5, TimeUnit.SECONDS).answer());
        }
        assertEquals(1, service.read(1, id).turns().size());
    }

    @Test
    void boundsStoredHistoryAndModelContextWindow() {
        AtomicInteger maximum = new AtomicInteger();
        var service = new YutoTestSupport().service(new YutoConversationStore(), (messages, tools) -> {
            maximum.accumulateAndGet(messages.size(), Math::max); return new AssistantMessage("답변");
        });
        var id = service.create(1, YutoTestSupport.course("course")).conversationId();
        for (int i = 0; i < 23; i++) service.send(1, id, "질문" + i);
        assertEquals(20, service.read(1, id).turns().size());
        assertEquals(22, maximum.get()); // System + ten user/assistant pairs + current user.
    }

    @Test
    void courseValidationRejectsDuplicateIdsAndInvalidCoordinates() {
        var stop = new YutoCourse.Stop("a", "장소", 37.0, 127.0);
        assertThrows(ApiException.class, () -> new YutoCourse("id", "코스", List.of(stop, stop)));
        assertThrows(ApiException.class, () -> new YutoCourse.Stop("a", "장소", Double.NaN, 127.0));
    }

    private static AssistantMessage call(String id, String name, String args) {
        return AssistantMessage.builder().content("").toolCalls(List.of(new ToolCall(id, "function", name, args))).build();
    }
}
