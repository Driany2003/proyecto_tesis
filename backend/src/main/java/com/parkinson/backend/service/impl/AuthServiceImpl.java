package com.parkinson.backend.service.impl;

import com.parkinson.backend.context.RequestContext;
import com.parkinson.backend.model.dto.request.LoginRequestDto;
import com.parkinson.backend.model.dto.response.LoginResponseDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.AuthorityRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.security.JwtService;
import com.parkinson.backend.security.SessionTracker;
import com.parkinson.backend.service.AuditLogService;
import com.parkinson.backend.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String COOKIE_NAME = "p_token";
    private static final long COOKIE_MAX_AGE_SECONDS = 7200;

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;
    private final RequestContext requestContext;
    private final SessionTracker sessionTracker;

    @Override
    @Transactional
    public LoginResponseDto login(LoginRequestDto request) {
        String clientIp = requestContext.getClientIp();

        User user = userRepository.findByEmailWithRole(request.getEmail()).orElse(null);
        if (user == null) {
            auditLogService.log(null, "LOGIN", "auth", null, "DENIED", clientIp,
                    "Credenciales inválidas (email no encontrado: " + request.getEmail() + ")");
            throw new BadCredentialsException("Credenciales inválidas");
        }
        if (!Boolean.TRUE.equals(user.getActive())) {
            auditLogService.log(user, "LOGIN", "auth", null, "DENIED", clientIp,
                    "Usuario inactivo: " + user.getEmail());
            throw new BadCredentialsException("Usuario inactivo");
        }
        var authority = authorityRepository.findByUser_Id(user.getId()).orElse(null);
        if (authority == null || !passwordEncoder.matches(request.getPassword(), authority.getPasswordHash())) {
            auditLogService.log(user, "LOGIN", "auth", null, "DENIED", clientIp,
                    "Credenciales inválidas (contraseña incorrecta)");
            throw new BadCredentialsException("Credenciales inválidas");
        }
        authority.setLastLoginAt(Instant.now());
        authorityRepository.save(authority);
        auditLogService.log(user, "LOGIN", "auth", null, "SUCCESS", clientIp,
                "Inicio de sesión exitoso");
        String token = jwtService.generateToken(user.getEmail());
        return LoginResponseDto.builder()
                .message("Login exitoso")
                .token(token)
                .user(toDto(user, authority.getUsername()))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserDto> getCurrentUser(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByEmailWithRole(email)
                .flatMap(user -> authorityRepository.findByUser_Id(user.getId())
                        .map(auth -> toDto(user, auth.getUsername())));
    }

    @Override
    public void logout(String token) {
        if (token != null) {
            sessionTracker.removeSession(token);
        }
    }

    @Override
    public String extractTokenFromRequest(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (COOKIE_NAME.equals(cookie.getName()) && cookie.getValue() != null) {
                    return cookie.getValue();
                }
            }
        }
        String bearer = request.getHeader("Authorization");
        if (bearer != null && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }

    @Override
    public ResponseCookie buildAuthCookie(String token) {
        return ResponseCookie.from(COOKIE_NAME, token)
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(COOKIE_MAX_AGE_SECONDS)
                .sameSite("Lax")
                .build();
    }

    private static UserDto toDto(User u, String username) {
        return UserDto.builder()
                .id(u.getId())
                .username(username)
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole().getName())
                .active(u.getActive())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .build();
    }
}
