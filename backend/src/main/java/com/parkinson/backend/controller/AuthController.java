package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.LoginRequestDto;
import com.parkinson.backend.model.dto.response.LoginResponseDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(@Valid @RequestBody LoginRequestDto request) {
        var dto = authService.login(request);
        // El token también va en el cuerpo: en CORS, el navegador no expone el header Authorization al JS
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
    public ResponseEntity<Void> logout() {
        return ResponseEntity.ok().build();
    }
}
