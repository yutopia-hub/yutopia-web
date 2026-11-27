package com.yutopia.resource;

import java.time.Instant;
import java.util.List;

import tools.jackson.databind.JsonNode;

public final class YutoChatDtos {
    private YutoChatDtos() { }

    public record CreateRequest(YutoCourse course) { }
    public record MessageRequest(String message) { }
    public record Evidence(String tool, boolean success, JsonNode result) { }
    public record Turn(String user, String assistant, Instant createdAt, List<Evidence> evidence) { }
    public record Conversation(String conversationId, YutoCourse course, List<Turn> turns, Instant expiresAt) { }
    public record Reply(String conversationId, String answer, List<Evidence> evidence, Instant expiresAt) { }
}
