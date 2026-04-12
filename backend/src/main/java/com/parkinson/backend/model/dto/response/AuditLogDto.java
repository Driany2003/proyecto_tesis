package com.parkinson.backend.model.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogDto {
    private UUID id;
    private Instant timestamp;
    private String userName;
    private String action;
    private String resource;
    private String resourceId;
    private String result;
    private String ip;
    private String details;
}
