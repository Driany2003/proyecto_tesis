package com.parkinson.backend.model.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RecordingStatusWebhookRequest(
        @NotNull UUID recordingId,
        @NotNull UUID patientId,
        @NotBlank String status,
        Double pParkinson,
        String riskBand,
        String errorMessage,
        JsonNode charts
) {}
