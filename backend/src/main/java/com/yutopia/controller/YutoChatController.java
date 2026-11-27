package com.yutopia.controller;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yutopia.exception.ApiException;
import com.yutopia.model.dto.Member;
import com.yutopia.resource.YutoChatDtos.*;
import com.yutopia.security.LoginMember;
import com.yutopia.service.YutoChatService;

@RestController
@RequestMapping("/api/ai/yuto/conversations")
public class YutoChatController {
    private final ObjectProvider<YutoChatService> services;

    public YutoChatController(ObjectProvider<YutoChatService> services) { this.services = services; }

    @PostMapping
    public ResponseEntity<Conversation> create(@LoginMember Member member, @RequestBody CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service().create(member.getMemberId(), request.course()));
    }

    @GetMapping("/{id}")
    public Conversation read(@LoginMember Member member, @PathVariable String id) {
        return service().read(member.getMemberId(), id);
    }

    @PostMapping("/{id}/messages")
    public Reply message(@LoginMember Member member, @PathVariable String id, @RequestBody MessageRequest request) {
        return service().send(member.getMemberId(), id, request.message());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@LoginMember Member member, @PathVariable String id) {
        service().delete(member.getMemberId(), id);
        return ResponseEntity.noContent().build();
    }

    private YutoChatService service() {
        var service = services.getIfAvailable();
        if (service == null) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "유토 AI 기능이 비활성화되어 있습니다.");
        return service;
    }
}
