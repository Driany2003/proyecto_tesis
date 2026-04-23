package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.LoginRequestDto;
import com.parkinson.backend.model.dto.response.LoginResponseDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(@Valid @RequestBody LoginRequestDto request, HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        log.info("Intento de login para email={} ip={}", request.getEmail(), clientIp);
        var dto = authService.login(request);
        log.info("Login exitoso para email={} ip={}", request.getEmail(), clientIp);
        // El token también va en el cuerpo: en CORS, el navegador no expone el header Authorization al JS
        return ResponseEntity.ok()
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + dto.getToken())
                .body(dto);
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal UserDetails userDetails, HttpServletRequest httpRequest) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        log.info("Consulta de perfil /auth/me para email={} ip={}", email, getClientIp(httpRequest));
        return ResponseEntity.of(authService.getCurrentUser(email));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal UserDetails userDetails, HttpServletRequest httpRequest) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        log.info("Logout para email={} ip={}", email, getClientIp(httpRequest));
        return ResponseEntity.ok().build();
    }

    private String getClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
