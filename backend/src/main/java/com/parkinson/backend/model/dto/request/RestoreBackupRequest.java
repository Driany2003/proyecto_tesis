package com.parkinson.backend.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RestoreBackupRequest {
    @NotBlank(message = "backupId es requerido")
    @Pattern(regexp = "^[0-9a-fA-F-]{36}$", message = "backupId debe ser un UUID válido")
    private String backupId;
}
