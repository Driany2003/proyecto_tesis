package com.parkinson.backend.repository;

import com.parkinson.backend.model.entity.RiskThreshold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RiskThresholdRepository extends JpaRepository<RiskThreshold, UUID> {
    Optional<RiskThreshold> findFirstByOrderByUpdatedAtDesc();
}
