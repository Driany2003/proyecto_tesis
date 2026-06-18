package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.LoginRequestDto;
import com.parkinson.backend.model.dto.response.LoginResponseDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.security.JwtAuthFilter;
import com.parkinson.backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
    public ResponseEntity<LoginResponseDto> login(
            @Valid @RequestBody LoginRequestDto request,
            HttpServletResponse httpResponse
    ) {
        var dto = authService.login(request);
        httpResponse.addHeader(HttpHeaders.SET_COOKIE, authService.buildAuthCookie(dto.getToken()).toString());
        return ResponseEntity.ok()
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + dto.getToken())
                .body(dto);
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.of(authService.getCurrentUser(email));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String token = authService.extractTokenFromRequest(request);
        authService.logout(token);
        JwtAuthFilter.eraseCookie(response);
        return ResponseEntity.ok().build();
    }
}
