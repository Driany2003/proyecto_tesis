package com.parkinson.backend.model.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponseDto {
    private final String message;
    private final String token;
}
