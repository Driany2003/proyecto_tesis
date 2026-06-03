package com.parkinson.backend.config;

import com.parkinson.backend.model.entity.Authority;
import com.parkinson.backend.model.entity.Role;
import com.parkinson.backend.model.entity.RolePermission;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.AuthorityRepository;
import com.parkinson.backend.repository.RolePermissionRepository;
import com.parkinson.backend.repository.RoleRepository;
import com.parkinson.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;

@Configuration
@Profile({"dev", "local"})
@RequiredArgsConstructor
public class DevDataLoader {

    private static final Map<String, List<String>> DEFAULT_PERMISSIONS = Map.of(
            "ADMIN",   List.of("dashboard", "patients", "recordings", "collection", "users", "configuracion", "audit"),
            "MEDICO",  List.of("dashboard", "patients", "recordings", "collection"),
            "AUDITOR", List.of("dashboard", "audit")
    );

    @Bean
    CommandLineRunner init(UserRepository userRepository,
                           AuthorityRepository authorityRepository,
                           RoleRepository roleRepository,
                           RolePermissionRepository permissionRepository,
                           PasswordEncoder passwordEncoder) {
        return args -> {
            Role adminRole = roleRepository.findByNameIgnoreCase("ADMIN")
                    .orElseGet(() -> roleRepository.save(Role.builder().name("ADMIN").build()));
            if (roleRepository.findByNameIgnoreCase("MEDICO").isEmpty()) {
                roleRepository.save(Role.builder().name("MEDICO").build());
            }
            if (roleRepository.findByNameIgnoreCase("AUDITOR").isEmpty()) {
                roleRepository.save(Role.builder().name("AUDITOR").build());
            }

            for (Map.Entry<String, List<String>> entry : DEFAULT_PERMISSIONS.entrySet()) {
                String roleName = entry.getKey();
                Role role = roleRepository.findByNameIgnoreCase(roleName).orElse(null);
                if (role == null) continue;
                for (String section : entry.getValue()) {
                    if (permissionRepository.findByRole_NameIgnoreCaseAndSectionName(roleName, section).isEmpty()) {
                        permissionRepository.save(RolePermission.builder()
                                .role(role)
                                .sectionName(section)
                                .enabled(true)
                                .build());
                    }
                }
            }

            if (userRepository.findByEmail("creo200307@gmail.com").isEmpty()) {
                User admin = User.builder()
                        .name("Administrador")
                        .email("creo200307@gmail.com")
                        .role(adminRole)
                        .active(true)
                        .build();
                admin = userRepository.save(admin);
                Authority auth = Authority.builder()
                        .username("admin")
                        .passwordHash(passwordEncoder.encode("Giomar2003"))
                        .role(admin.getRole())
                        .user(admin)
                        .build();
                authorityRepository.save(auth);
            }
        };
    }
}
