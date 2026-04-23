package com.parkinson.backend.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parkinson.backend.config.MinioProperties;
import com.parkinson.backend.config.WebhookProperties;
import com.parkinson.backend.event.RecordingPipelineRequestedEvent;
import com.parkinson.backend.exception.BadRequestException;
import com.parkinson.backend.exception.ResourceNotFoundException;
import com.parkinson.backend.exception.StorageException;
import com.parkinson.backend.model.dto.request.RecordingNotesPatchRequest;
import com.parkinson.backend.model.dto.request.RecordingStatusWebhookRequest;
import com.parkinson.backend.model.dto.response.RecordingAudioUrlDto;
import com.parkinson.backend.model.dto.response.RecordingListItemDto;
import com.parkinson.backend.model.dto.response.RecordingSummaryDto;
import com.parkinson.backend.model.dto.response.RecordingUploadResponse;
import com.parkinson.backend.model.entity.Patient;
import com.parkinson.backend.model.entity.Recording;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.PatientRepository;
import com.parkinson.backend.repository.RecordingRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.service.MinioStorageService;
import com.parkinson.backend.service.RecordingService;
import com.parkinson.backend.util.Strings;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecordingServiceImpl implements RecordingService {

    private static final int MIN_DURATION = 3;
    private static final int MAX_DURATION = 300;
    private static final int MAX_NOTE_LENGTH = 8000;
    private static final int MAX_ERROR_LENGTH = 2000;

    private final PatientRepository patientRepository;
    private final RecordingRepository recordingRepository;
    private final UserRepository userRepository;
    private final MinioStorageService minioStorageService;
    private final MinioProperties minioProperties;
    private final WebhookProperties webhookProperties;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public RecordingUploadResponse createRecording(
            UUID patientId,
            MultipartFile file,
            int durationSeconds,
            String userEmail
    ) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("El archivo de audio es obligatorio");
        }
        if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
            throw new BadRequestException("La duración debe estar entre " + MIN_DURATION + " y " + MAX_DURATION + " segundos");
        }

        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Paciente", patientId));

        UUID recordingId = UUID.randomUUID();
        String ext = extensionFromFilename(file.getOriginalFilename());
        String objectKey = minioStorageService.buildObjectKey(patientId, recordingId, ext);

        minioStorageService.upload(objectKey, file);

        User createdBy = userRepository.findByEmail(userEmail).orElse(null);

        Recording recording = Recording.builder()
                .id(recordingId)
                .patient(patient)
                .createdBy(createdBy)
                .durationSeconds(durationSeconds)
                .filePath(objectKey)
                .status("processing")
                .build();
        recordingRepository.save(recording);

        String presignedUrl = minioStorageService.presignedGetUrl(objectKey);
        String physicianId = createdBy != null ? createdBy.getId().toString() : null;

        Map<String, Object> clinical = buildClinicalMap(patient);

        eventPublisher.publishEvent(new RecordingPipelineRequestedEvent(
                recordingId,
                recordingId.toString(),
                patientId.toString(),
                presignedUrl,
                physicianId,
                clinical
        ));

        return new RecordingUploadResponse(
                recordingId,
                recordingId.toString(),
                "processing",
                "Grabación recibida. El análisis se ejecuta en segundo plano (n8n)."
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecordingSummaryDto> listByPatient(UUID patientId) {
        requirePatientExists(patientId);
        return recordingRepository.findSummaryByPatientId(patientId);
    }

    @Override
    @Transactional(readOnly = true)
    public RecordingListItemDto getByIdForPatient(UUID patientId, UUID recordingId) {
        requirePatientExists(patientId);
        return toListItem(findRecording(patientId, recordingId));
    }

    @Override
    @Transactional(readOnly = true)
    public RecordingAudioUrlDto getAudioUrl(UUID patientId, UUID recordingId) {
        requirePatientExists(patientId);
        Recording r = findRecording(patientId, recordingId);
        if (r.getFilePath() == null || r.getFilePath().isBlank()) {
            throw new BadRequestException("No hay archivo de audio asociado a esta sesión");
        }
        String url = minioStorageService.presignedGetUrl(r.getFilePath());
        return new RecordingAudioUrlDto(url, minioProperties.getPresignGetMinutes());
    }

    @Override
    @Transactional
    public RecordingListItemDto patchNotes(UUID patientId, UUID recordingId, RecordingNotesPatchRequest body) {
        requirePatientExists(patientId);
        Recording r = findRecording(patientId, recordingId);
        if (body.noteConsiderations() != null) {
            r.setNoteConsiderations(truncateNote(body.noteConsiderations()));
        }
        if (body.noteAnnotations() != null) {
            r.setNoteAnnotations(truncateNote(body.noteAnnotations()));
        }
        if (body.noteComplications() != null) {
            r.setNoteComplications(truncateNote(body.noteComplications()));
        }
        recordingRepository.save(r);
        return toListItem(r);
    }

    @Override
    @Transactional
    public void updateRecordingFromPipelineWebhook(String headerSecret, RecordingStatusWebhookRequest body) {
        String configured = webhookProperties.getRecordingSecret();
        log.info("[Webhook] Recibido. recordingId={} status={} secretRecibido='{}' secretConfigurado='{}'",
                body.recordingId(), body.status(),
                headerSecret != null ? headerSecret : "(null)",
                configured != null ? configured : "(null)");
        if (configured == null || configured.isBlank()) {
            log.warn("[Webhook] app.webhook.recording-secret no configurado → 503");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Webhook de grabaciones no configurado (app.webhook.recording-secret)"
            );
        }
        if (headerSecret == null || !configured.equals(headerSecret)) {
            log.warn("[Webhook] Secreto inválido. Esperado='{}' Recibido='{}'", configured, headerSecret);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Secreto de webhook inválido");
        }

        String st = body.status() != null ? body.status().trim().toLowerCase() : "";
        if (!"completed".equals(st) && !"failed".equals(st)) {
            throw new BadRequestException("status debe ser 'completed' o 'failed'");
        }

        Recording recording = recordingRepository
                .findByIdAndPatient_Id(body.recordingId(), body.patientId())
                .orElseThrow(() -> new ResourceNotFoundException("Grabación", body.recordingId()));

        recording.setStatus(st);
        recording.setProcessedAt(Instant.now());
        if ("completed".equals(st)) {
            recording.setPParkinson(body.pParkinson());
            recording.setRiskBand(body.riskBand());
            recording.setErrorMessage(null);
            recording.setChartsJson(chartsToJsonString(body.charts()));
        } else {
            recording.setErrorMessage(Strings.truncate(body.errorMessage(), MAX_ERROR_LENGTH));
            recording.setPParkinson(null);
            recording.setRiskBand(null);
            recording.setChartsJson(null);
        }
        recordingRepository.save(recording);
    }

    private void requirePatientExists(UUID patientId) {
        if (!patientRepository.existsById(patientId)) {
            throw new ResourceNotFoundException("Paciente", patientId);
        }
    }

    private Recording findRecording(UUID patientId, UUID recordingId) {
        return recordingRepository
                .findByIdAndPatient_Id(recordingId, patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Grabación", recordingId));
    }

    private static String truncateNote(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return Strings.truncate(t, MAX_NOTE_LENGTH);
    }

    private String chartsToJsonString(JsonNode charts) {
        if (charts == null || charts.isNull() || charts.isMissingNode()) {
            return null;
        }
        if (charts.isObject() && charts.size() == 0) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(charts);
        } catch (Exception e) {
            throw new BadRequestException("charts no es JSON válido");
        }
    }

    private RecordingListItemDto toListItem(Recording r) {
        String physicianName = r.getCreatedBy() != null ? r.getCreatedBy().getName() : null;
        boolean audioAvailable = r.getFilePath() != null && !r.getFilePath().isBlank();
        String audioUrl = null;
        Integer audioUrlExpiresInMinutes = null;
        if (audioAvailable) {
            try {
                audioUrl = minioStorageService.presignedGetUrl(r.getFilePath());
                audioUrlExpiresInMinutes = minioProperties.getPresignGetMinutes();
            } catch (StorageException e) {
                log.warn("No se pudo generar presigned URL para grabación {}: {}", r.getId(), e.getMessage());
            }
        }
        return new RecordingListItemDto(
                r.getId(),
                r.getStatus(),
                r.getDurationSeconds(),
                r.getCreatedAt(),
                r.getProcessedAt(),
                r.getPParkinson(),
                r.getRiskBand(),
                r.getErrorMessage(),
                parseCharts(r.getChartsJson()),
                physicianName,
                r.getNoteConsiderations(),
                r.getNoteAnnotations(),
                r.getNoteComplications(),
                audioAvailable,
                audioUrl,
                audioUrlExpiresInMinutes
        );
    }

    private Map<String, Object> parseCharts(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> m = objectMapper.readValue(json, new TypeReference<>() {});
            return (m == null || m.isEmpty()) ? null : Map.copyOf(m);
        } catch (Exception e) {
            log.warn("No se pudo parsear charts_json (longitud={}): {}", json.length(), e.getMessage());
            return null;
        }
    }

    private static Map<String, Object> buildClinicalMap(Patient patient) {
        Map<String, Object> clinical = new LinkedHashMap<>();
        clinical.put("age", patient.getAge());
        clinical.put("sex", abbreviateSex(patient.getGender()));
        if (patient.getSymptomsOnsetMonths() != null) {
            clinical.put("symptom_onset_months", patient.getSymptomsOnsetMonths());
        }
        if (patient.getMedication() != null && !patient.getMedication().isBlank()) {
            clinical.put("medication", patient.getMedication());
        }
        return clinical;
    }

    private static String abbreviateSex(String gender) {
        if (gender == null) return "";
        String g = gender.trim().toUpperCase();
        if (g.startsWith("M")) return "M";
        if (g.startsWith("F")) return "F";
        return gender.length() > 1 ? gender.substring(0, 1) : gender;
    }

    private static String extensionFromFilename(String original) {
        if (original == null || !original.contains(".")) {
            return ".webm";
        }
        return original.substring(original.lastIndexOf('.')).toLowerCase();
    }
}
