package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.UpdatePermissionRequest;
import com.parkinson.backend.service.RolePermissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<Void> updatePermission(@RequestBody @Valid UpdatePermissionRequest request) {
        permissionService.setPermission(request.getRole(), request.getSection(), request.isEnabled());
        return ResponseEntity.noContent().build();
    }
}
