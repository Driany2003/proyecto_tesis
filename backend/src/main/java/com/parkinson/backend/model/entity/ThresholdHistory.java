package com.parkinson.backend.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "T_threshold_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ThresholdHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_threshold_history_user"))
    private User user;

    @Column(name = "prev_low_max", nullable = false)
    private Double prevLowMax;
    @Column(name = "prev_moderate_min", nullable = false)
    private Double prevModerateMin;
    @Column(name = "prev_moderate_max", nullable = false)
    private Double prevModerateMax;
    @Column(name = "prev_high_min", nullable = false)
    private Double prevHighMin;
    @Column(name = "prev_alert_threshold", nullable = false)
    private Double prevAlertThreshold;

    @Column(name = "next_low_max", nullable = false)
    private Double nextLowMax;
    @Column(name = "next_moderate_min", nullable = false)
    private Double nextModerateMin;
    @Column(name = "next_moderate_max", nullable = false)
    private Double nextModerateMax;
    @Column(name = "next_high_min", nullable = false)
    private Double nextHighMin;
    @Column(name = "next_alert_threshold", nullable = false)
    private Double nextAlertThreshold;

    @Column(length = 500)
    private String reason;
}
