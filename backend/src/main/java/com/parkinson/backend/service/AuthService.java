package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.request.LoginRequestDto;
import com.parkinson.backend.model.dto.response.LoginResponseDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.model.entity.User;

import java.util.Optional;

public interface AuthService {
    /** clientIp puede ser null (ej. tests). Se usa para auditoría. */
    LoginResponseDto login(LoginRequestDto request, String clientIp);

    /** Usuario actual por email (para /auth/me). Sin lógica en el controlador. */
    Optional<UserDto> getCurrentUser(String email);

    /** Entidad User del usuario actual (para auditoría y uso interno). */
    Optional<User> getCurrentUserEntity(String email);
}
