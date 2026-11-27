package com.yutopia.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.lang.reflect.Proxy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.yutopia.exception.GlobalExceptionHandler;
import com.yutopia.model.dao.MemberDao;
import com.yutopia.model.dto.Member;
import com.yutopia.resource.YutoChatDtos.CreateRequest;
import com.yutopia.security.AuthInterceptor;
import com.yutopia.security.LoginMemberArgumentResolver;
import com.yutopia.security.TokenProvider;
import com.yutopia.service.YutoChatService;
import com.yutopia.service.YutoConversationStore;
import com.yutopia.service.YutoTestSupport;

/** Standalone MockMvc: actual auth interceptor, stub member DAO/model/providers. No server or DB. */
class YutoChatControllerTest {
    private static final String BASE = "/api/ai/yuto/conversations";
    private MockMvc mvc;
    private TokenProvider tokens;
    private Member first, second;
    private AuthInterceptor auth;

    @BeforeEach
    void setup() {
        first = member(1L); second = member(2L);
        MemberDao dao = (MemberDao) Proxy.newProxyInstance(MemberDao.class.getClassLoader(), new Class<?>[] { MemberDao.class },
                (proxy, method, args) -> method.getName().equals("findById")
                        ? (Long.valueOf(1).equals(args[0]) ? first : second) : null);
        tokens = new TokenProvider("test-only-token-secret-at-least-32-characters", 1, dao);
        auth = new AuthInterceptor(tokens);
        var service = new YutoTestSupport().service(new YutoConversationStore(), (messages, tools) -> new AssistantMessage("어느 구간이 궁금한가요?"));
        var beans = new StaticListableBeanFactory();
        beans.addBean("yuto", service);
        mvc = mockMvc(beans);
    }

    @Test
    void allConversationEndpointsRequireBearerAuthentication() throws Exception {
        mvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/unknown")).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE + "/unknown/messages").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"질문\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(BASE + "/unknown")).andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedConversationLifecycleReturnsJsonAndHistory() throws Exception {
        String id = create();
        mvc.perform(post(BASE + "/" + id + "/messages").header("Authorization", bearer(first))
                .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"코스 알려줘\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.conversationId").value(id))
                .andExpect(jsonPath("$.answer").isNotEmpty());
        String body = mvc.perform(get(BASE + "/" + id).header("Authorization", bearer(first)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(1, YutoTestSupport.JSON.readTree(body).path("turns").size());
        mvc.perform(delete(BASE + "/" + id).header("Authorization", bearer(first))).andExpect(status().isNoContent());
        mvc.perform(get(BASE + "/" + id).header("Authorization", bearer(first))).andExpect(status().isNotFound());
    }

    @Test
    void anotherMemberCannotReadWriteOrDeleteConversation() throws Exception {
        String id = create();
        mvc.perform(get(BASE + "/" + id).header("Authorization", bearer(second))).andExpect(status().isNotFound());
        mvc.perform(post(BASE + "/" + id + "/messages").header("Authorization", bearer(second))
                .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"질문\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete(BASE + "/" + id).header("Authorization", bearer(second))).andExpect(status().isNotFound());
    }

    @Test
    void disabledAiProfileRespondsWithServiceUnavailable() throws Exception {
        var disabled = mockMvc(new StaticListableBeanFactory());
        disabled.perform(post(BASE).header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON)
                .content(YutoTestSupport.JSON.writeValueAsString(new CreateRequest(YutoTestSupport.course("course")))))
                .andExpect(status().isServiceUnavailable());
    }

    private String create() throws Exception {
        String body = mvc.perform(post(BASE).header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON)
                .content(YutoTestSupport.JSON.writeValueAsString(new CreateRequest(YutoTestSupport.course("course")))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return YutoTestSupport.JSON.readTree(body).path("conversationId").asString();
    }

    private MockMvc mockMvc(StaticListableBeanFactory beans) {
        return MockMvcBuilders.standaloneSetup(new YutoChatController(beans.getBeanProvider(YutoChatService.class)))
                .setCustomArgumentResolvers(new LoginMemberArgumentResolver()).addInterceptors(auth)
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    private String bearer(Member member) { return "Bearer " + tokens.issue(member); }
    private static Member member(Long id) {
        Member member = new Member(); member.setMemberId(id); member.setPasswordHash("test-hash");
        member.setEmail("member" + id + "@example.com"); member.setNickname("member" + id); return member;
    }
}
