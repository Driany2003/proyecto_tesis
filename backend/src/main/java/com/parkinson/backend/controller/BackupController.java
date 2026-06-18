package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.RestoreBackupRequest;
import com.parkinson.backend.model.dto.response.BackupRecordDto;
import com.parkinson.backend.service.BackupRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    @PostMapping
    public ResponseEntity<BackupRecordDto> createBackup(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        BackupRecordDto dto = backupRecordService.createBackup(email);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/restore")
    public ResponseEntity<BackupRecordDto> restore(
            @RequestBody @Valid RestoreBackupRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        UUID backupId = UUID.fromString(request.getBackupId());
        BackupRecordDto dto = backupRecordService.restore(backupId, email);
        return ResponseEntity.ok(dto);
    }
}
