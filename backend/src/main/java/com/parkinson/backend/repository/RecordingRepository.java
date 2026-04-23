package com.parkinson.backend.repository;

import com.parkinson.backend.model.dto.response.RecordingSummaryDto;
import com.parkinson.backend.model.entity.Recording;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecordingRepository extends JpaRepository<Recording, UUID> {

    @Query("""
            SELECT new com.parkinson.backend.model.dto.response.RecordingSummaryDto(
                r.id, r.status, r.durationSeconds, r.createdAt, r.processedAt,
                r.pParkinson, r.riskBand, r.errorMessage, u.name, r.filePath)
            FROM Recording r
            LEFT JOIN r.createdBy u
            WHERE r.patient.id = :patientId
            ORDER BY r.createdAt DESC
            """)
    List<RecordingSummaryDto> findSummaryByPatientId(@Param("patientId") UUID patientId);

    Optional<Recording> findByIdAndPatient_Id(UUID id, UUID patientId);
}
