package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.request.CreatePatientDto;
import com.parkinson.backend.model.dto.response.PatientDto;
import com.parkinson.backend.model.dto.response.PatientListItemDto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientService {
    List<PatientListItemDto> findAll(Optional<String> search);
    Optional<PatientDto> findById(UUID id);
    PatientDto create(CreatePatientDto dto);
    PatientDto update(UUID id, CreatePatientDto dto);
}
