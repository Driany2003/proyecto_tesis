package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.CreatePatientDto;
import com.parkinson.backend.model.dto.response.PatientDto;
import com.parkinson.backend.model.dto.response.PatientListItemDto;
import com.parkinson.backend.service.PatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    @GetMapping
    public List<PatientListItemDto> findAll(@RequestParam(required = false) String search) {
        return patientService.findAll(Optional.ofNullable(search));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PatientDto> findById(@PathVariable UUID id) {
        return patientService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<PatientDto> create(@Valid @RequestBody CreatePatientDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientService.create(dto));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<PatientDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreatePatientDto dto
    ) {
        return ResponseEntity.ok(patientService.update(id, dto));
    }
}
