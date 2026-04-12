package com.parkinson.backend.service.impl;

import com.parkinson.backend.model.dto.request.LoginRequestDto;
import com.parkinson.backend.model.dto.response.LoginResponseDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.AuthorityRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.security.JwtService;
import com.parkinson.backend.service.AuditLogService;
import com.parkinson.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;

    @Override
    @Transactional
    public LoginResponseDto login(LoginRequestDto request, String clientIp) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new BadCredentialsException("Usuario inactivo");
        }
        var authority = authorityRepository.findByUser_Id(user.getId())
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));
        if (!passwordEncoder.matches(request.getPassword(), authority.getPasswordHash())) {
            throw new BadCredentialsException("Credenciales inválidas");
        }
        authority.setLastLoginAt(Instant.now());
        authorityRepository.save(authority);
        auditLogService.log(user, "LOGIN", "auth", null, "SUCCESS", clientIp, "Inicio de sesión");
        String token = jwtService.generateToken(user.getEmail());
        UserDto userDto = toDto(user, authority.getUsername());
        return LoginResponseDto.builder()
                .message("Login exitoso")
                .user(userDto)
                .token(token)
                .build();
    }

    @Override
    public Optional<UserDto> getCurrentUser(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByEmail(email)
                .flatMap(user -> authorityRepository.findByUser_Id(user.getId())
                        .map(auth -> toDto(user, auth.getUsername())));
    }

    @Override
    public Optional<User> getCurrentUserEntity(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByEmail(email);
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
