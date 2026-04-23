package com.parkinson.backend.event;

import com.parkinson.backend.service.N8nTriggerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class RecordingPipelineEventListener {

    private final N8nTriggerService n8nTriggerService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRecordingPipelineRequested(RecordingPipelineRequestedEvent event) {
        log.debug("AFTER_COMMIT: disparando pipeline n8n para recording={}", event.recordingId());
        n8nTriggerService.triggerParkinsonAnalyze(
                event.recordingId(),
                event.sessionId(),
                event.patientId(),
                event.audioUri(),
                event.physicianId(),
                event.clinical()
        );
    }
}
