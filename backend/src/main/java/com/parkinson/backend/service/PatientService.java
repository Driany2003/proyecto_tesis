package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.request.CreatePatientDto;
import com.parkinson.backend.model.dto.response.PatientDto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientService {
    List<PatientDto> findAll(Optional<String> search);
    Optional<PatientDto> findById(UUID id);
    /** currentUserEmail y clientIp opcionales; si se pasan, se registra en auditoría. */
    PatientDto create(CreatePatientDto dto, String currentUserEmail, String clientIp);
    PatientDto update(UUID id, CreatePatientDto dto, String currentUserEmail, String clientIp);
}
