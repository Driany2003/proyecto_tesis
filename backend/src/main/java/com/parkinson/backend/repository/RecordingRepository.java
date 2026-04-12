package com.parkinson.backend.repository;

import com.parkinson.backend.model.entity.Recording;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecordingRepository extends JpaRepository<Recording, UUID> {
    List<Recording> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
