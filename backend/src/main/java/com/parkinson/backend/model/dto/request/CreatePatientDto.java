package com.parkinson.backend.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreatePatientDto {
    @NotBlank
    @Size(max = 255)
    private String fullName;

    @NotNull
    private Integer age;

    @NotBlank
    @Size(max = 50)
    private String gender;

    @NotBlank
    @Size(max = 20)
    private String dni;

    @Size(max = 2000)
    private String medicalHistory;

    @Size(max = 500)
    private String medication;

    @Size(max = 1000)
    private String comorbidities;

    private Integer symptomsOnsetMonths;
}
