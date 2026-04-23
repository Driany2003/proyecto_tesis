package com.parkinson.backend.model.dto.response;

public record RecordingAudioUrlDto(
        String url,
        int expiresInMinutes
) {}
