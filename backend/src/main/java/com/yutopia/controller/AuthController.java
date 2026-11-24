package com.yutopia.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yutopia.controller.dto.AuthDtos.AuthResponse;
import com.yutopia.controller.dto.AuthDtos.LoginRequest;
import com.yutopia.controller.dto.AuthDtos.PasswordResetConfirmRequest;
import com.yutopia.controller.dto.AuthDtos.PasswordResetRequest;
import com.yutopia.controller.dto.AuthDtos.PasswordResetResponse;
import com.yutopia.controller.dto.AuthDtos.SignupRequest;
import com.yutopia.service.AuthService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(authService.signup(request.email(), request.password(), request.nickname()));
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest request) {
        return authService.login(request.email(), request.password());
    }

    /** 토큰은 서버에 저장하지 않으므로 클라이언트가 지우면 끝. 인증 확인만 한다. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset")
    public PasswordResetResponse requestReset(@RequestBody PasswordResetRequest request) {
        return authService.requestPasswordReset(request.email());
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> confirmReset(@RequestBody PasswordResetConfirmRequest request) {
        authService.confirmPasswordReset(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }
}
