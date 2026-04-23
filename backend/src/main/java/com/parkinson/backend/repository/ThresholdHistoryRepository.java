package com.parkinson.backend.repository;

import com.parkinson.backend.model.entity.ThresholdHistory;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ThresholdHistoryRepository extends JpaRepository<ThresholdHistory, UUID> {
    @EntityGraph(attributePaths = "user")
    List<ThresholdHistory> findAllByOrderByChangedAtDesc(org.springframework.data.domain.Pageable pageable);
}
