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
    UserDto create(CreateUserDto dto);
    UserDto update(UUID id, UpdateUserDto dto);
}
