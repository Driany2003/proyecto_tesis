package com.parkinson.backend.event;

import java.util.Map;
import java.util.UUID;

public record RecordingPipelineRequestedEvent(
        UUID recordingId,
        String sessionId,
        String patientId,
        String audioUri,
        String physicianId,
        Map<String, Object> clinical
) {}
