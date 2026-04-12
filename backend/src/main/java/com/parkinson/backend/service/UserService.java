package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.request.CreateUserDto;
import com.parkinson.backend.model.dto.request.UpdateUserDto;
import com.parkinson.backend.model.dto.response.UserDto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserService {
    List<UserDto> findAll();
    Optional<UserDto> findById(UUID id);
    /** currentUserEmail y clientIp opcionales; si se pasan, se registra en auditoría. */
    UserDto create(CreateUserDto dto, String currentUserEmail, String clientIp);
    UserDto update(UUID id, UpdateUserDto dto, String currentUserEmail, String clientIp);
}
