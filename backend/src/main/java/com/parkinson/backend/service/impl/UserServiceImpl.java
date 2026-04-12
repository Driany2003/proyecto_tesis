package com.parkinson.backend.service.impl;

import com.parkinson.backend.model.dto.request.CreateUserDto;
import com.parkinson.backend.model.dto.request.UpdateUserDto;
import com.parkinson.backend.model.dto.response.UserDto;
import com.parkinson.backend.model.entity.Authority;
import com.parkinson.backend.model.entity.Role;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.exception.BadRequestException;
import com.parkinson.backend.exception.ResourceNotFoundException;
import com.parkinson.backend.repository.AuthorityRepository;
import com.parkinson.backend.repository.RoleRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.service.AuditLogService;
import com.parkinson.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Override
    @Transactional(readOnly = true)
    public List<UserDto> findAll() {
        return userRepository.findAllWithAuthority().stream().map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserDto> findById(UUID id) {
        return userRepository.findByIdWithAuthority(id).map(this::toDto);
    }

    @Override
    @Transactional
    public UserDto create(CreateUserDto dto, String currentUserEmail, String clientIp) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new BadRequestException("El correo ya está registrado");
        }
        Role role = roleRepository.findByNameIgnoreCase(dto.getRole())
                .orElseThrow(() -> new ResourceNotFoundException("Rol", dto.getRole()));
        String username = (dto.getUsername() != null && !dto.getUsername().isBlank())
                ? dto.getUsername()
                : dto.getEmail();
        if (authorityRepository.findByUsernameIgnoreCase(username).isPresent()) {
            throw new BadRequestException("El nombre de usuario ya está en uso");
        }
        User user = User.builder()
                .name(dto.getName())
                .email(dto.getEmail())
                .role(role)
                .active(true)
                .build();
        user = userRepository.save(user);
        String encodedPassword = passwordEncoder.encode(dto.getPassword());
        Authority authority = Authority.builder()
                .username(username)
                .passwordHash(encodedPassword)
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .user(user)
                .build();
        authorityRepository.save(authority);
        UserDto result = toDto(user);
        if (currentUserEmail != null && !currentUserEmail.isBlank()) {
            userRepository.findByEmail(currentUserEmail).ifPresent(actor ->
                    auditLogService.log(actor, "CREATE", "user", result.getId().toString(), "SUCCESS", clientIp, "Usuario creado")
            );
        }
        return result;
    }

    @Override
    @Transactional
    public UserDto update(UUID id, UpdateUserDto dto, String currentUserEmail, String clientIp) {
        User user = userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Usuario", id));
        if (dto.getEmail() != null && !dto.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(dto.getEmail())) {
                throw new BadRequestException("El correo ya está registrado");
            }
            user.setEmail(dto.getEmail());
        }
        if (dto.getName() != null) user.setName(dto.getName());
        if (dto.getRole() != null) {
            Role role = roleRepository.findByNameIgnoreCase(dto.getRole())
                    .orElseThrow(() -> new ResourceNotFoundException("Rol", dto.getRole()));
            user.setRole(role);
        }
        if (dto.getActive() != null) user.setActive(dto.getActive());
        User savedUser = userRepository.save(user);
        authorityRepository.findByUser_Id(id).ifPresent(auth -> {
            if (dto.getUsername() != null && !dto.getUsername().isBlank()) {
                authorityRepository.findByUsernameIgnoreCase(dto.getUsername()).ifPresent(other -> {
                    if (!other.getUser().getId().equals(id)) {
                        throw new BadRequestException("El nombre de usuario ya está en uso");
                    }
                });
                auth.setUsername(dto.getUsername());
            }
            auth.setRole(savedUser.getRole());
            if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
                auth.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
            }
            authorityRepository.save(auth);
        });
        UserDto result = toDto(savedUser);
        if (currentUserEmail != null && !currentUserEmail.isBlank()) {
            userRepository.findByEmail(currentUserEmail).ifPresent(actor ->
                    auditLogService.log(actor, "UPDATE", "user", id.toString(), "SUCCESS", clientIp, "Usuario actualizado")
            );
        }
        return result;
    }

    private UserDto toDto(User u) {
        String username = u.getAuthority() != null ? u.getAuthority().getUsername() : null;
        return UserDto.builder()
                .id(u.getId())
                .username(username)
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole().getName())
                .active(u.getActive())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .build();
    }
}
