package com.parkinson.backend.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "T_risk_thresholds")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskThreshold {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "low_max", nullable = false)
    private Double lowMax;

    @Column(name = "moderate_min", nullable = false)
    private Double moderateMin;

    @Column(name = "moderate_max", nullable = false)
    private Double moderateMax;

    @Column(name = "high_min", nullable = false)
    private Double highMin;

    @Column(name = "alert_threshold", nullable = false)
    private Double alertThreshold;

    @Column(name = "critical_threshold")
    private Double criticalThreshold;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void prePersist() {
        updatedAt = Instant.now();
    }
}
