package com.parkinson.backend.config;

import com.parkinson.backend.model.entity.Authority;
import com.parkinson.backend.model.entity.Role;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.AuthorityRepository;
import com.parkinson.backend.repository.RoleRepository;
import com.parkinson.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile({"dev", "local"})
@RequiredArgsConstructor
public class DevDataLoader {

    @Bean
    CommandLineRunner init(UserRepository userRepository, AuthorityRepository authorityRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            Role adminRole = roleRepository.findByNameIgnoreCase("ADMIN")
                    .orElseGet(() -> roleRepository.save(Role.builder().name("ADMIN").build()));
            if (roleRepository.findByNameIgnoreCase("MEDICO").isEmpty()) {
                roleRepository.save(Role.builder().name("MEDICO").build());
            }
            if (roleRepository.findByNameIgnoreCase("AUDITOR").isEmpty()) {
                roleRepository.save(Role.builder().name("AUDITOR").build());
            }
            if (userRepository.findByEmail("admin@test.com").isEmpty()) {
                User admin = User.builder()
                        .name("Administrador")
                        .email("admin@test.com")
                        .role(adminRole)
                        .active(true)
                        .build();
                admin = userRepository.save(admin);
                Authority auth = Authority.builder()
                        .username("admin")
                        .passwordHash(passwordEncoder.encode("password"))
                        .role(admin.getRole())
                        .createdAt(admin.getCreatedAt())
                        .updatedAt(admin.getUpdatedAt())
                        .user(admin)
                        .build();
                authorityRepository.save(auth);
            }
        };
    }
}
