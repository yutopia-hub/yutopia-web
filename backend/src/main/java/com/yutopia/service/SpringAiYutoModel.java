package com.yutopia.service;

import java.util.List;

import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Spring AI 2.0 ChatModel returns tool requests; the bounded server loop executes them. */
@Component
@Profile("ai")
public class SpringAiYutoModel implements YutoModel {
    private final ChatModel model;

    public SpringAiYutoModel(ChatModel model) { this.model = model; }

    @Override
    public AssistantMessage next(List<Message> messages, List<ToolCallback> tools) {
        var options = ToolCallingChatOptions.builder().toolCallbacks(tools).build();
        var response = model.call(new Prompt(messages, options));
        return response == null || response.getResult() == null ? null : response.getResult().getOutput();
    }
}
