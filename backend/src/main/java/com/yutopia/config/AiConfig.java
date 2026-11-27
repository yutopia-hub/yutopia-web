package com.yutopia.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import com.yutopia.tool.WalkingRouteTool;
import com.yutopia.tool.RoutePlaceSearchTool;
import com.yutopia.tool.DetourTimeComparisonTool;

/** AI infrastructure only; constructing the client does not call the model. */
@Configuration(proxyBeanMethods = false)
@Profile("ai")
public class AiConfig {
    @Bean
    public ChatClient travelChatClient(ChatClient.Builder builder, WalkingRouteTool walkingRouteTool,
            RoutePlaceSearchTool routePlaceSearchTool, DetourTimeComparisonTool detourTimeComparisonTool) {
        return builder.defaultTools(walkingRouteTool, routePlaceSearchTool, detourTimeComparisonTool).build();
    }
}
