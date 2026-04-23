package com.parkinson.backend.service.impl;

import com.parkinson.backend.context.RequestContext;
import com.parkinson.backend.model.dto.request.CreatePatientDto;
import com.parkinson.backend.model.dto.response.PatientDto;
import com.parkinson.backend.model.dto.response.PatientListItemDto;
import com.parkinson.backend.exception.ResourceNotFoundException;
import com.parkinson.backend.model.entity.Patient;
import com.parkinson.backend.repository.PatientRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.service.AuditLogService;
import com.parkinson.backend.service.PatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PatientServiceImpl implements PatientService {

    private final PatientRepository patientRepository;
    private final AuditLogService auditLogService;
    private final UserRepository userRepository;
    private final RequestContext requestContext;

    @Override
    @Transactional(readOnly = true)
    public List<PatientListItemDto> findAll(Optional<String> search) {
        return search
                .filter(s -> !s.isBlank())
                .map(String::trim)
                .map(patientRepository::searchSummary)
                .orElseGet(patientRepository::findAllSummaryOrdered);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PatientDto> findById(UUID id) {
        return patientRepository.findById(id).map(this::toDto);
    }

    @Override
    @Transactional
    public PatientDto create(CreatePatientDto dto) {
        Patient patient = patientRepository.save(toEntity(dto));
        PatientDto result = toDto(patient);
        String email = requestContext.getCurrentUserEmail();
        if (email != null) {
            userRepository.findByEmail(email).ifPresent(actor ->
                    auditLogService.log(actor, "CREATE", "patient", result.getId().toString(),
                            "SUCCESS", requestContext.getClientIp(), "Paciente creado")
            );
        }
        return result;
    }

    @Override
    @Transactional
    public PatientDto update(UUID id, CreatePatientDto dto) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Paciente", id));
        patient.setFullName(dto.getFullName());
        patient.setAge(dto.getAge());
        patient.setGender(dto.getGender());
        patient.setDni(dto.getDni());
        patient.setMedicalHistory(dto.getMedicalHistory());
        patient.setMedication(dto.getMedication());
        patient.setComorbidities(dto.getComorbidities());
        patient.setSymptomsOnsetMonths(dto.getSymptomsOnsetMonths());
        PatientDto result = toDto(patientRepository.save(patient));
        String email = requestContext.getCurrentUserEmail();
        if (email != null) {
            userRepository.findByEmail(email).ifPresent(actor ->
                    auditLogService.log(actor, "UPDATE", "patient", id.toString(),
                            "SUCCESS", requestContext.getClientIp(), "Paciente actualizado")
            );
        }
        return result;
    }

    private Patient toEntity(CreatePatientDto dto) {
        return Patient.builder()
                .fullName(dto.getFullName())
                .age(dto.getAge())
                .gender(dto.getGender())
                .dni(dto.getDni())
                .medicalHistory(dto.getMedicalHistory())
                .medication(dto.getMedication())
                .comorbidities(dto.getComorbidities())
                .symptomsOnsetMonths(dto.getSymptomsOnsetMonths())
                .build();
    }

    private PatientDto toDto(Patient p) {
        return PatientDto.builder()
                .id(p.getId())
                .fullName(p.getFullName())
                .age(p.getAge())
                .gender(p.getGender())
                .dni(p.getDni())
                .medicalHistory(p.getMedicalHistory())
                .medication(p.getMedication())
                .comorbidities(p.getComorbidities())
                .symptomsOnsetMonths(p.getSymptomsOnsetMonths())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
