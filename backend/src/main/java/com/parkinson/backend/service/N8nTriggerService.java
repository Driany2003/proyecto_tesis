package com.parkinson.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkinson.backend.config.N8nProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class N8nTriggerService {

    private final N8nProperties n8nProperties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Async
    public void triggerParkinsonAnalyze(
            String sessionId,
            String patientId,
            String audioUri,
            String physicianId,
            Map<String, Object> clinical
    ) {
        String url = n8nProperties.getWebhookUrl();
        if (url == null || url.isBlank()) {
            log.warn("app.n8n.webhook-url vacío: no se dispara n8n. Configure la URL del webhook.");
            return;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("session_id", sessionId);
        body.put("patient_id", patientId);
        body.put("audio_uri", audioUri);
        if (physicianId != null && !physicianId.isBlank()) {
            body.put("physician_id", physicianId);
        }
        body.put("clinical", clinical != null ? clinical : Map.of());

        /* Serializar a String: si se envía Map, Spring puede poner Content-Type
         * application/json;charset=UTF-8 y el Webhook de n8n deja body={}. */
        final String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            log.error("No se pudo serializar payload n8n para session_id={}", sessionId, e);
            return;
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(jsonPayload, headers);

        try {
            log.info("Disparando n8n webhook: session_id={}", sessionId);
            restTemplate.postForEntity(url, entity, String.class);
            log.info("n8n webhook respondió OK para session_id={}", sessionId);
        } catch (Exception e) {
            log.error("Error llamando a n8n webhook para session_id={}: {}", sessionId, e.getMessage());
        }
    }
}
