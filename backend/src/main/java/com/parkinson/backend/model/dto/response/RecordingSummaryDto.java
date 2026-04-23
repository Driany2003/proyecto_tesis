package com.parkinson.backend.model.dto.response;

import java.time.Instant;
import java.util.UUID;

public record RecordingSummaryDto(
        UUID id,
        String status,
        int durationSeconds,
        Instant createdAt,
        Instant processedAt,
        Double pParkinson,
        String riskBand,
        String errorMessage,
        String physicianName,
        boolean audioAvailable
) {
    public RecordingSummaryDto(
            UUID id,
            String status,
            int durationSeconds,
            Instant createdAt,
            Instant processedAt,
            Double pParkinson,
            String riskBand,
            String errorMessage,
            String physicianName,
            String filePath
    ) {
        this(
                id,
                status,
                durationSeconds,
                createdAt,
                processedAt,
                pParkinson,
                riskBand,
                errorMessage,
                physicianName,
                filePath != null && !filePath.isBlank()
        );
    }
}
