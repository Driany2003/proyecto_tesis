package com.parkinson.backend.model.dto.response;

import java.util.UUID;

public record RecordingUploadResponse(
        UUID recordingId,
        String sessionId,
        String status,
        String message
) {}
