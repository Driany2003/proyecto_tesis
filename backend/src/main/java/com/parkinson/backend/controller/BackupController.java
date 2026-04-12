package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.response.BackupRecordDto;
import com.parkinson.backend.service.BackupRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/backups")
@RequiredArgsConstructor
public class BackupController {

    private final BackupRecordService backupRecordService;

    @GetMapping
    public List<BackupRecordDto> findAll() {
        return backupRecordService.findAll();
    }

    @PostMapping("/restore")
    public ResponseEntity<Map<String, String>> restore(@RequestBody Map<String, String> body) {
        String backupIdStr = body.get("backupId");
        if (backupIdStr == null || backupIdStr.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "backupId requerido"));
        }
        try {
            backupRecordService.restore(UUID.fromString(backupIdStr));
            return ResponseEntity.ok(Map.of("message", "Restauración solicitada"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "backupId inválido"));
        }
    }
}
