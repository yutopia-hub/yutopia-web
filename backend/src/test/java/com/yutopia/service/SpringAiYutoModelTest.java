package com.yutopia.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.model.tool.ToolCallingChatOptions;

class SpringAiYutoModelTest {
    @Test
    void usesSpringAiPromptAndOptionsWithoutProviderSpecificCalls() {
        ChatModel fake = prompt -> {
            assertEquals("질문", prompt.getUserMessage().getText());
            assertInstanceOf(ToolCallingChatOptions.class, prompt.getOptions());
            assertTrue(((ToolCallingChatOptions) prompt.getOptions()).getToolCallbacks().isEmpty());
            return new ChatResponse(List.of(new Generation(new AssistantMessage("답변"))));
        };
        var result = new SpringAiYutoModel(fake).next(List.of(new UserMessage("질문")), List.of());
        assertEquals("답변", result.getText());
    }

    @Test
    void emptyModelResponseIsHandledByEngineBoundary() {
        assertNull(new SpringAiYutoModel(prompt -> null).next(List.of(new UserMessage("질문")), List.of()));
    }
}
