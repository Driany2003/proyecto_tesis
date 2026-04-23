package com.parkinson.backend.model.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientListItemDto {
    private UUID id;
    private String fullName;
    private Integer age;
    private String gender;
    private String dni;
    private Instant createdAt;
    private Instant updatedAt;
}
