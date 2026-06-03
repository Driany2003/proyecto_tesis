package com.parkinson.backend.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkinson.backend.config.N8nProperties;
import com.parkinson.backend.context.RequestContext;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.RecordingRepository;
import com.parkinson.backend.service.AuditLogService;
import com.parkinson.backend.service.N8nTriggerService;
import com.parkinson.backend.util.Strings;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class N8nTriggerServiceImpl implements N8nTriggerService {

    private static final int MAX_ERROR_LENGTH = 2000;

    private final N8nProperties n8nProperties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final RecordingRepository recordingRepository;
    private final N8nTriggerService self;
    private final AuditLogService auditLogService;
    private final RequestContext requestContext;

    public N8nTriggerServiceImpl(N8nProperties n8nProperties,
                                 RestTemplate restTemplate,
                                 ObjectMapper objectMapper,
                                 RecordingRepository recordingRepository,
                                 @Lazy N8nTriggerService self,
                                 AuditLogService auditLogService,
                                 RequestContext requestContext) {
        this.n8nProperties = n8nProperties;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.recordingRepository = recordingRepository;
        this.self = self;
        this.auditLogService = auditLogService;
        this.requestContext = requestContext;
    }

    @Override
    @Async
    public void triggerParkinsonAnalyze(
            UUID recordingId,
            String sessionId,
            String patientId,
            String audioUri,
            String physicianId,
            Map<String, Object> clinical
    ) {
        String url = n8nProperties.getWebhookUrl();
        if (url == null || url.isBlank()) {
            log.warn("app.n8n.webhook-url vacío: no se dispara n8n");
            self.markRecordingFailed(recordingId, "Webhook de n8n no configurado");
            return;
        }

        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(buildPayload(sessionId, patientId, audioUri, physicianId, clinical));
        } catch (JsonProcessingException e) {
            log.error("No se pudo serializar payload n8n para session_id={}", sessionId, e);
            self.markRecordingFailed(recordingId, "Error serializando payload n8n: " + e.getMessage());
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(jsonPayload, headers);

        try {
            log.info("Disparando n8n webhook: session_id={}", sessionId);
            var response = restTemplate.postForEntity(url, entity, String.class);
            log.info("n8n webhook respondió HTTP {} para session_id={}", response.getStatusCode().value(), sessionId);
            auditLogService.log(null, "PIPELINE_TRIGGER", "recording", recordingId.toString(),
                    "SUCCESS", null,
                    "Pipeline n8n disparado: session=" + sessionId);
        } catch (HttpStatusCodeException e) {
            handleHttpError(recordingId, sessionId, e);
        } catch (Exception e) {
            log.error("Error llamando a n8n webhook para session_id={}: {}", sessionId, e.getMessage());
            self.markRecordingFailed(recordingId, "Error contactando n8n: " + e.getMessage());
        }
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markRecordingFailed(UUID recordingId, String reason) {
        if (recordingId == null) {
            return;
        }
        try {
            recordingRepository.findById(recordingId).ifPresent(rec -> {
                String status = rec.getStatus();
                if ("completed".equalsIgnoreCase(status) || "failed".equalsIgnoreCase(status)) {
                    return;
                }
                rec.setStatus("failed");
                rec.setProcessedAt(Instant.now());
                rec.setErrorMessage(Strings.truncate(reason, MAX_ERROR_LENGTH));
                recordingRepository.save(rec);

                User createdBy = rec.getCreatedBy();
                if (createdBy != null) {
                    auditLogService.log(createdBy, "PIPELINE_FAILED", "recording",
                            recordingId.toString(), "ERROR", null,
                            "Pipeline n8n fallido: " + Strings.truncate(reason, 300));
                } else {
                    auditLogService.log(null, "PIPELINE_FAILED", "recording",
                            recordingId.toString(), "ERROR", "n8n-system",
                            "Pipeline n8n fallido: " + Strings.truncate(reason, 300));
                }
                log.info("Grabación {} marcada como failed: {}", recordingId, reason);
            });
        } catch (Exception e) {
            log.error("No se pudo marcar grabación {} como failed: {}", recordingId, e.getMessage());
        }
    }

    private static Map<String, Object> buildPayload(String sessionId,
                                                    String patientId,
                                                    String audioUri,
                                                    String physicianId,
                                                    Map<String, Object> clinical) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("session_id", sessionId);
        body.put("patient_id", patientId);
        body.put("audio_uri", audioUri);
        if (physicianId != null && !physicianId.isBlank()) {
            body.put("physician_id", physicianId);
        }
        body.put("clinical", clinical != null ? clinical : Map.of());
        return body;
    }

    private void handleHttpError(UUID recordingId, String sessionId, HttpStatusCodeException e) {
        String body = e.getResponseBodyAsString();
        int status = e.getStatusCode().value();
        if (body != null && body.contains("\"ok\":false")) {
            log.warn("n8n respondió {} con ok=false (pipeline en rama de error). session_id={}. Body: {}",
                    status, sessionId, Strings.truncateForLog(body, MAX_ERROR_LENGTH));
            auditLogService.log(null, "PIPELINE_TRIGGER", "recording", recordingId.toString(),
                    "ERROR", null,
                    "n8n respondió ok=false: " + Strings.truncate(body, 300));
            self.markRecordingFailed(recordingId, "Pipeline n8n retornó ok=false");
            return;
        }
        log.error("Error HTTP llamando a n8n webhook para session_id={}: {} {}",
                sessionId, status, Strings.truncateForLog(body, MAX_ERROR_LENGTH));
        auditLogService.log(null, "PIPELINE_TRIGGER", "recording", recordingId.toString(),
                "ERROR", null,
                "n8n respondió HTTP " + status);
        self.markRecordingFailed(recordingId, "n8n respondió HTTP " + status);
    }
}
