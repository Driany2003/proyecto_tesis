package com.parkinson.backend.controller;

import com.parkinson.backend.service.RolePermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/settings/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final RolePermissionService permissionService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getPermissions() {
        return ResponseEntity.ok(Map.of(
                "sections", permissionService.getSections(),
                "permissions", permissionService.getAllPermissionsByRole()
        ));
    }

    @PutMapping
    public ResponseEntity<Void> updatePermission(@RequestBody Map<String, Object> body) {
        String role = (String) body.get("role");
        String section = (String) body.get("section");
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        permissionService.setPermission(role, section, enabled);
        return ResponseEntity.noContent().build();
    }
}
