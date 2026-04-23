package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.RecordingStatusWebhookRequest;
import com.parkinson.backend.service.RecordingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/webhooks")
@RequiredArgsConstructor
public class RecordingWebhookController {

    private final RecordingService recordingService;

    @GetMapping(value = "/recording-status", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> recordingStatusPing() {
        return ResponseEntity.ok(Map.of(
                "method", "GET",
                "info", "Para actualizar grabaciones use POST con JSON y cabecera X-Webhook-Secret",
                "postPath", "/api/webhooks/recording-status"
        ));
    }

    @PostMapping(value = "/recording-status", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> recordingStatus(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret,
            @Valid @RequestBody RecordingStatusWebhookRequest body
    ) {
        recordingService.updateRecordingFromPipelineWebhook(secret, body);
        return ResponseEntity.noContent().build();
    }
}
