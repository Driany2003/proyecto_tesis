package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.request.LoginRequestDto;
import com.parkinson.backend.model.dto.response.LoginResponseDto;
import com.parkinson.backend.model.dto.response.UserDto;

import java.util.Optional;

public interface AuthService {

    LoginResponseDto login(LoginRequestDto request);

    Optional<UserDto> getCurrentUser(String email);
}
