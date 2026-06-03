package com.parkinson.backend.service.impl;

import com.parkinson.backend.context.RequestContext;
import com.parkinson.backend.model.entity.Role;
import com.parkinson.backend.model.entity.RolePermission;
import com.parkinson.backend.repository.RolePermissionRepository;
import com.parkinson.backend.repository.RoleRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.service.AuditLogService;
import com.parkinson.backend.service.RolePermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class RolePermissionServiceImpl implements RolePermissionService {

    private static final List<String> ALL_SECTIONS = List.of(
            "dashboard", "patients", "recordings", "collection",
            "users", "configuracion", "audit"
    );

    private final RolePermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final AuditLogService auditLogService;
    private final RequestContext requestContext;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public List<String> getSections() {
        return ALL_SECTIONS;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<String>> getAllPermissionsByRole() {
        Map<String, List<String>> result = new LinkedHashMap<>();
        List<RolePermission> all = permissionRepository.findAllByOrderByRole_NameAscSectionNameAsc();

        for (RolePermission p : all) {
            String role = p.getRole().getName();
            result.computeIfAbsent(role, k -> new ArrayList<>());
            if (Boolean.TRUE.equals(p.getEnabled())) {
                result.get(role).add(p.getSectionName());
            }
        }
        return result;
    }

    @Override
    @Transactional
    public void setPermission(String roleName, String sectionName, boolean enabled) {
        Role role = roleRepository.findByNameIgnoreCase(roleName)
                .orElseThrow(() -> new RuntimeException("Rol no encontrado: " + roleName));

        RolePermission perm = permissionRepository
                .findByRole_NameIgnoreCaseAndSectionName(roleName, sectionName)
                .orElseGet(() -> RolePermission.builder()
                        .role(role)
                        .sectionName(sectionName)
                        .enabled(false)
                        .build());

        perm.setEnabled(enabled);
        permissionRepository.save(perm);

        messagingTemplate.convertAndSend("/topic/permissions/" + roleName.toLowerCase(),
                Map.of("role", roleName, "section", sectionName, "enabled", enabled, "timestamp", Instant.now().toString()));

        String email = requestContext.getCurrentUserEmail();
        if (email != null) {
            userRepository.findByEmail(email).ifPresent(actor ->
                    auditLogService.log(actor, "PERMISSION_UPDATE", "role_permission",
                            roleName + "/" + sectionName, "SUCCESS",
                            requestContext.getClientIp(),
                            "Permiso " + sectionName + " para rol " + roleName + " = " + enabled)
            );
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasPermission(String roleName, String sectionName) {
        return permissionRepository
                .existsByRole_NameIgnoreCaseAndSectionNameAndEnabledTrue(roleName, sectionName);
    }
}
