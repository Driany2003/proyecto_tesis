package com.parkinson.backend.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdatePermissionRequest {
    @NotBlank(message = "role es requerido")
    private String role;

    @NotBlank(message = "section es requerido")
    private String section;

    private boolean enabled;
}
