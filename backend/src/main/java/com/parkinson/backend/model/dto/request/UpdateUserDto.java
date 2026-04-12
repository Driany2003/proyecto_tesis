package com.parkinson.backend.model.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateUserDto {
    @Size(max = 100)
    private String username;

    @Size(max = 255)
    private String name;

    @Email
    @Size(max = 255)
    private String email;

    @Size(min = 8, max = 100)
    private String password;

    @Size(max = 50)
    private String role;

    private Boolean active;
}
