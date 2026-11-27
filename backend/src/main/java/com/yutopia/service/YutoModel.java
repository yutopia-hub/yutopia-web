package com.yutopia.service;

import java.util.List;

import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.tool.ToolCallback;

/** Model boundary, replaceable with a deterministic stub in tests. */
public interface YutoModel {
    AssistantMessage next(List<Message> messages, List<ToolCallback> tools);
}
