package com.parkinson.backend.model.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    private UUID id;
    private String username;
    private String name;
    private String email;
    private String role;
    private Boolean active;
    private Instant createdAt;
    private Instant updatedAt;
}
