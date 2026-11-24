package com.yutopia.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yutopia.controller.dto.AuthDtos.DeleteMemberRequest;
import com.yutopia.controller.dto.AuthDtos.UpdateMemberRequest;
import com.yutopia.controller.dto.AuthDtos.UserResponse;
import com.yutopia.controller.dto.PlaceDtos.FavoriteRequest;
import com.yutopia.controller.dto.PlaceDtos.MemoRequest;
import com.yutopia.controller.dto.PlaceDtos.PlaceResponse;
import com.yutopia.model.dto.Member;
import com.yutopia.security.LoginMember;
import com.yutopia.service.FavoriteService;
import com.yutopia.service.MemberService;

import lombok.RequiredArgsConstructor;

/** 로그인 회원 본인 리소스. 모든 경로는 AuthInterceptor 가 보호한다. */
@RestController
@RequestMapping("/api/members/me")
@RequiredArgsConstructor
public class MemberController {
    private final MemberService memberService;
    private final FavoriteService favoriteService;

    @GetMapping
    public UserResponse me(@LoginMember Member member) {
        return UserResponse.from(member);
    }

    @PatchMapping
    public UserResponse update(@LoginMember Member member, @RequestBody UpdateMemberRequest request) {
        return memberService.updateNickname(member, request.nickname());
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@LoginMember Member member, @RequestBody DeleteMemberRequest request) {
        memberService.delete(member, request.password());
        return ResponseEntity.noContent().build();
    }

    // ---- 보따리(찜) ----

    @GetMapping("/favorites")
    public List<PlaceResponse> favorites(@LoginMember Member member) {
        return favoriteService.list(member);
    }

    @PutMapping("/favorites/{placeId}")
    public PlaceResponse addFavorite(@LoginMember Member member, @PathVariable String placeId,
            @RequestBody(required = false) FavoriteRequest request) {
        return favoriteService.add(member, placeId, request);
    }

    @PatchMapping("/favorites/{placeId}")
    public PlaceResponse updateMemo(@LoginMember Member member, @PathVariable String placeId,
            @RequestBody MemoRequest request) {
        return favoriteService.updateMemo(member, placeId, request.memo());
    }

    @DeleteMapping("/favorites/{placeId}")
    public ResponseEntity<Void> removeFavorite(@LoginMember Member member, @PathVariable String placeId) {
        favoriteService.remove(member, placeId);
        return ResponseEntity.noContent().build();
    }
}
