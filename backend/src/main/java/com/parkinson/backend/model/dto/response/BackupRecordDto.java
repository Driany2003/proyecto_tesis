package com.parkinson.backend.model.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BackupRecordDto {
    private UUID id;
    private Instant date;
    private Long sizeBytes;
    private Integer durationSeconds;
    private String status;
    private String integrityHash;
}
