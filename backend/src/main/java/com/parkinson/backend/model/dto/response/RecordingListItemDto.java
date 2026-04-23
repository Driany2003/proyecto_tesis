package com.parkinson.backend.model.dto.response;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record RecordingListItemDto(
        UUID id,
        String status,
        int durationSeconds,
        Instant createdAt,
        Instant processedAt,
        Double pParkinson,
        String riskBand,
        String errorMessage,
        Map<String, Object> charts,
        String physicianName,
        String noteConsiderations,
        String noteAnnotations,
        String noteComplications,
        boolean audioAvailable,
        String audioUrl,
        Integer audioUrlExpiresInMinutes
) {}
