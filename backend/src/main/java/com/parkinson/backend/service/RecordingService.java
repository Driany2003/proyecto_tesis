package com.parkinson.backend.service;

import com.parkinson.backend.exception.BadRequestException;
import com.parkinson.backend.exception.ResourceNotFoundException;
import com.parkinson.backend.model.dto.response.RecordingUploadResponse;
import com.parkinson.backend.model.entity.Patient;
import com.parkinson.backend.model.entity.Recording;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.PatientRepository;
import com.parkinson.backend.repository.RecordingRepository;
import com.parkinson.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecordingService {

    private static final int MIN_DURATION = 3;
    private static final int MAX_DURATION = 300;

    private final PatientRepository patientRepository;
    private final RecordingRepository recordingRepository;
    private final UserRepository userRepository;
    private final MinioStorageService minioStorageService;
    private final N8nTriggerService n8nTriggerService;

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

        try {
            minioStorageService.upload(objectKey, file);
        } catch (Exception e) {
            throw new BadRequestException("No se pudo subir el audio a almacenamiento: " + e.getMessage());
        }

        Recording recording = Recording.builder()
                .id(recordingId)
                .patient(patient)
                .durationSeconds(durationSeconds)
                .filePath(objectKey)
                .status("processing")
                .build();
        recordingRepository.save(recording);

        String presignedUrl;
        try {
            presignedUrl = minioStorageService.presignedGetUrl(objectKey);
        } catch (Exception e) {
            throw new BadRequestException("No se pudo generar URL de acceso al audio: " + e.getMessage());
        }

        String physicianId = userRepository.findByEmail(userEmail)
                .map(u -> u.getId().toString())
                .orElse(null);

        Map<String, Object> clinical = buildClinicalMap(patient);

        n8nTriggerService.triggerParkinsonAnalyze(
                recordingId.toString(),
                patientId.toString(),
                presignedUrl,
                physicianId,
                clinical
        );

        return new RecordingUploadResponse(
                recordingId,
                recordingId.toString(),
                "processing",
                "Grabación recibida. El análisis se ejecuta en segundo plano (n8n)."
        );
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
