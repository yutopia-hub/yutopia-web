package com.yutopia.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage.ToolResponse;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.yutopia.exception.ApiException;
import com.yutopia.prompt.YutoPrompt;
import com.yutopia.resource.YutoChatDtos.Evidence;
import com.yutopia.resource.YutoChatDtos.Turn;
import com.yutopia.resource.YutoCourse;
import com.yutopia.tool.DetourTimeComparisonTool;
import com.yutopia.tool.RoutePlaceSearchTool;
import com.yutopia.tool.WalkingRouteTool;

import tools.jackson.databind.json.JsonMapper;

/** A bounded, server-owned tool loop. No advisor is allowed to execute tools implicitly. */
@Component
@Profile("ai")
public class YutoChatEngine {
    private final YutoModel model;
    private final YutoPrompt prompt;
    private final JsonMapper json;
    private final WalkingRouteTool walking;
    private final RoutePlaceSearchTool search;
    private final DetourTimeComparisonTool detour;

    public YutoChatEngine(YutoModel model, YutoPrompt prompt, JsonMapper json,
            WalkingRouteTool walking, RoutePlaceSearchTool search, DetourTimeComparisonTool detour) {
        this.model = model; this.prompt = prompt; this.json = json;
        this.walking = walking; this.search = search; this.detour = detour;
    }

    Outcome answer(YutoCourse course, List<Turn> history, LinkedHashMap<String, YutoCourseTools.Candidate> candidates, String text) {
        var bound = new YutoCourseTools(course, candidates, walking, search, detour);
        var callbacks = List.of(ToolCallbacks.from(bound));
        Map<String, ToolCallback> registry = new HashMap<>();
        callbacks.forEach(c -> registry.put(c.getToolDefinition().name(), c));
        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(prompt.system(course, bound.availableCandidates())));
        for (Turn turn : history.subList(Math.max(0, history.size() - 10), history.size())) {
            messages.add(new UserMessage(turn.user()));
            messages.add(new AssistantMessage(turn.assistant()));
        }
        messages.add(new UserMessage(text));
        List<Evidence> evidence = new ArrayList<>();
        var callIds = new HashSet<String>();
        int calls = 0;
        for (int round = 0; round < 4; round++) {
            AssistantMessage output = model.next(List.copyOf(messages), callbacks);
            if (output == null) throw invalidModel();
            if (!output.hasToolCalls()) {
                String answer = output.getText();
                if (answer == null || answer.isBlank() || answer.length() > 6000) throw invalidModel();
                return new Outcome(answer.trim(), List.copyOf(evidence), bound.candidates());
            }
            if (round == 3 || calls + output.getToolCalls().size() > 6) {
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "조회 단계가 길어졌습니다. 구간이나 질문을 나누어 다시 요청해 주세요.");
            }
            // Reject the entire batch before any execution if the model invented a tool/ID.
            for (var call : output.getToolCalls()) {
                if (!registry.containsKey(call.name()) || call.id() == null || call.id().isBlank()
                        || call.id().length() > 128 || !callIds.add(call.id())
                        || call.arguments() == null || call.arguments().length() > 4000) throw invalidModel();
            }
            messages.add(output);
            List<ToolResponse> results = new ArrayList<>();
            for (var call : output.getToolCalls()) {
                calls++;
                boolean success = true;
                String data;
                try {
                    data = registry.get(call.name()).call(call.arguments());
                    json.readTree(data);
                } catch (RuntimeException error) {
                    success = false;
                    data = json.writeValueAsString(Map.of("error", safeToolError(error)));
                }
                evidence.add(new Evidence(call.name(), success, json.readTree(data)));
                results.add(new ToolResponse(call.id(), call.name(), data));
            }
            messages.add(ToolResponseMessage.builder().responses(results).build());
        }
        throw invalidModel();
    }

    private static String safeToolError(Throwable error) {
        for (int i = 0; error != null && i < 10; i++, error = error.getCause()) {
            if (error instanceof ApiException known) return known.getMessage();
        }
        return "도구의 입력 또는 조회를 처리하지 못했습니다. 코스 구간과 검색 장소를 확인해 주세요.";
    }

    private static ApiException invalidModel() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "유토가 올바른 답변을 생성하지 못했습니다. 다시 시도해 주세요.");
    }

    record Outcome(String answer, List<Evidence> evidence, LinkedHashMap<String, YutoCourseTools.Candidate> candidates) { }
}
