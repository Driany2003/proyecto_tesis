package com.parkinson.backend.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "T_patients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Patient extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Column(nullable = false)
    private Integer age;

    @Column(nullable = false, length = 50)
    private String gender;

    @Column(nullable = false, unique = true, length = 20)
    private String dni;

    @Column(name = "medical_history", length = 2000)
    private String medicalHistory;

    @Column(length = 500)
    private String medication;

    @Column(length = 1000)
    private String comorbidities;

    @Column(name = "symptoms_onset_months")
    private Integer symptomsOnsetMonths;
}
