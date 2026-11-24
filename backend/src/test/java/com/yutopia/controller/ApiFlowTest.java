package com.yutopia.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.DefaultTransactionDefinition;
import org.springframework.web.context.WebApplicationContext;

import com.yutopia.YutopiaApplication;
import com.yutopia.support.TestDatabaseSafetyConfiguration;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 프론트가 호출하는 순서대로 REST API 전체 흐름을 실제 MySQL(yutopia_test)로 검증한다. 테스트마다 롤백.
 * JUnit 5.14 + Spring 7 조합이라 SpringExtension 대신 컨텍스트를 직접 띄운다 (docs/dao-tests.md 참고).
 */
class ApiFlowTest {
    private static ConfigurableApplicationContext context;
    private static MockMvc mvc;
    private static JsonMapper json;
    private TransactionStatus transaction;

    @BeforeAll
    static void startContext() {
        context = new SpringApplicationBuilder(YutopiaApplication.class, TestDatabaseSafetyConfiguration.class)
                .profiles("test").web(WebApplicationType.SERVLET).properties("server.port=0").run();
        mvc = MockMvcBuilders.webAppContextSetup((WebApplicationContext) context).build();
        json = context.getBean(JsonMapper.class);
    }

    @AfterAll
    static void stopContext() {
        if (context != null) context.close();
    }

    @BeforeEach
    void begin() {
        transaction = context.getBean(PlatformTransactionManager.class).getTransaction(new DefaultTransactionDefinition());
    }

    @AfterEach
    void rollback() {
        context.getBean(PlatformTransactionManager.class).rollback(transaction);
    }

    private final String email = "flow-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    private final String externalId = "T" + UUID.randomUUID().toString().substring(0, 8);

    private MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder builder, String content) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(content);
    }

    private String signup() throws Exception {
        String response = mvc.perform(body(post("/api/auth/signup"),
                "{\"email\":\"" + email.toUpperCase() + "\",\"password\":\"abc12345\",\"nickname\":\"여행자\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.nickname").value("여행자"))
                .andExpect(jsonPath("$.token").value(notNullValue()))
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(response);
        return node.get("token").asString();
    }

    @Test
    @DisplayName("회원가입 → 로그인 → 내 정보 조회·수정 → 탈퇴")
    void memberFlow() throws Exception {
        signup();
        mvc.perform(body(post("/api/auth/signup"),
                "{\"email\":\"" + email + "\",\"password\":\"abc12345\",\"nickname\":\"중복\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다."));

        mvc.perform(body(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"wrong1234\"}"))
                .andExpect(status().isUnauthorized());
        String token = json.readTree(mvc.perform(body(post("/api/auth/login"),
                "{\"email\":\"" + email + "\",\"password\":\"abc12345\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asString();
        String bearer = "Bearer " + token;

        mvc.perform(get("/api/members/me").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
        mvc.perform(body(patch("/api/members/me"), "{\"nickname\":\"새닉네임\"}").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("새닉네임"));
        mvc.perform(body(patch("/api/members/me"), "{\"nickname\":\"!\"}").header("Authorization", bearer))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/logout").header("Authorization", bearer)).andExpect(status().isNoContent());

        mvc.perform(body(delete("/api/members/me"), "{\"password\":\"nope12345\"}").header("Authorization", bearer))
                .andExpect(status().isBadRequest());
        mvc.perform(body(delete("/api/members/me"), "{\"password\":\"abc12345\"}").header("Authorization", bearer))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/members/me").header("Authorization", bearer)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("인증 없거나 위조된 토큰은 401, CORS 사전 요청은 허용")
    void authGuard() throws Exception {
        mvc.perform(get("/api/members/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(notNullValue()));
        mvc.perform(get("/api/members/me").header("Authorization", "Bearer abc.def")).andExpect(status().isUnauthorized());
        mvc.perform(options("/api/members/me/favorites").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "PUT")
                .header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    @DisplayName("비밀번호 재설정 후 기존 토큰은 무효, 새 비밀번호로 로그인")
    void passwordReset() throws Exception {
        String oldBearer = "Bearer " + signup();
        String resetToken = json.readTree(mvc.perform(body(post("/api/auth/password-reset"), "{\"email\":\"" + email + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("resetToken").asString();

        mvc.perform(body(post("/api/auth/password-reset/confirm"), "{\"token\":\"bad\",\"password\":\"newpass123\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(body(post("/api/auth/password-reset/confirm"),
                "{\"token\":\"" + resetToken + "\",\"password\":\"newpass123\"}")).andExpect(status().isNoContent());

        mvc.perform(get("/api/members/me").header("Authorization", oldBearer)).andExpect(status().isUnauthorized());
        mvc.perform(body(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"newpass123\"}"))
                .andExpect(status().isOk());
        // 없는 이메일도 같은 200 응답 (가입 여부 비노출)
        mvc.perform(body(post("/api/auth/password-reset"), "{\"email\":\"nobody-x@example.com\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.resetToken").doesNotExist());
    }

    @Test
    @DisplayName("보따리 담기(멱등) → 메모 → 목록 → 여행지 검색·상세 → 빼기")
    void favoriteAndPlaceFlow() throws Exception {
        String bearer = "Bearer " + signup();
        String snapshot = "{\"provider\":\"TOUR_API\",\"title\":\"테스트 궁궐 " + externalId + "\",\"address\":\"서울 종로구\","
                + "\"lat\":37.57,\"lng\":126.97,\"image\":\"https://example.com/a.jpg\",\"contentTypeId\":\"12\"}";

        for (int i = 0; i < 2; i++) {
            mvc.perform(body(put("/api/members/me/favorites/" + externalId), snapshot).header("Authorization", bearer))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(externalId))
                    .andExpect(jsonPath("$.contentTypeId").value("12"))
                    .andExpect(jsonPath("$.image").value("https://example.com/a.jpg"))
                    .andExpect(jsonPath("$.lat").value(37.57));
        }
        mvc.perform(body(patch("/api/members/me/favorites/" + externalId), "{\"memo\":\"  꼭 가기  \"}")
                .header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.memo").value("꼭 가기"));
        mvc.perform(get("/api/members/me/favorites").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].addedAt").value(notNullValue()));

        mvc.perform(get("/api/places").param("keyword", externalId))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("테스트 궁궐 " + externalId));
        mvc.perform(get("/api/places/" + externalId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images", hasSize(1)))
                .andExpect(jsonPath("$.memo").doesNotExist());
        mvc.perform(get("/api/places/__none__")).andExpect(status().isNotFound());
        mvc.perform(get("/api/areas")).andExpect(status().isOk());

        mvc.perform(delete("/api/members/me/favorites/" + externalId).header("Authorization", bearer))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/members/me/favorites/" + externalId).header("Authorization", bearer))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/members/me/favorites").header("Authorization", bearer))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(body(put("/api/members/me/favorites/NEW-" + externalId), "{}").header("Authorization", bearer))
                .andExpect(status().isBadRequest());
    }
}
