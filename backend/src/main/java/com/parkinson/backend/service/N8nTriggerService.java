package com.parkinson.backend.service;

import java.util.Map;
import java.util.UUID;

public interface N8nTriggerService {

    void triggerParkinsonAnalyze(UUID recordingId,
                                 String sessionId,
                                 String patientId,
                                 String audioUri,
                                 String physicianId,
                                 Map<String, Object> clinical);

    void markRecordingFailed(UUID recordingId, String reason);
}
