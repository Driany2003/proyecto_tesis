package com.parkinson.backend.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "T_recordings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Recording {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false, foreignKey = @ForeignKey(name = "fk_recording_patient"))
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", foreignKey = @ForeignKey(name = "fk_recording_created_by"))
    private User createdBy;

    @Column(name = "duration_seconds", nullable = false)
    private Integer durationSeconds;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(length = 20)
    @Builder.Default
    private String status = "pending";

    @Column(name = "p_parkinson")
    private Double pParkinson;

    @Column(name = "risk_band", length = 32)
    private String riskBand;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "charts_json", columnDefinition = "TEXT")
    private String chartsJson;

    @Column(name = "note_considerations", columnDefinition = "TEXT")
    private String noteConsiderations;

    @Column(name = "note_annotations", columnDefinition = "TEXT")
    private String noteAnnotations;

    @Column(name = "note_complications", columnDefinition = "TEXT")
    private String noteComplications;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
