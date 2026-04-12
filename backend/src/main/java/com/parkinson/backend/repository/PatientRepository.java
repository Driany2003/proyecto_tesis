package com.parkinson.backend.repository;

import com.parkinson.backend.model.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {
    Optional<Patient> findByDni(String dni);
    boolean existsByDni(String dni);
    List<Patient> findByFullNameContainingIgnoreCaseOrDniContaining(String fullName, String dni);
}
