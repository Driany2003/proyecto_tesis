package com.parkinson.backend.repository;

import com.parkinson.backend.model.dto.response.PatientListItemDto;
import com.parkinson.backend.model.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {

    @Query("""
            SELECT new com.parkinson.backend.model.dto.response.PatientListItemDto(
                p.id, p.fullName, p.age, p.gender, p.dni, p.createdAt, p.updatedAt)
            FROM Patient p
            ORDER BY p.fullName ASC
            """)
    List<PatientListItemDto> findAllSummaryOrdered();

    @Query("""
            SELECT new com.parkinson.backend.model.dto.response.PatientListItemDto(
                p.id, p.fullName, p.age, p.gender, p.dni, p.createdAt, p.updatedAt)
            FROM Patient p
            WHERE LOWER(p.fullName) LIKE LOWER(CONCAT('%', :term, '%'))
               OR p.dni LIKE CONCAT('%', :term, '%')
            ORDER BY p.fullName ASC
            """)
    List<PatientListItemDto> searchSummary(@Param("term") String term);
}
