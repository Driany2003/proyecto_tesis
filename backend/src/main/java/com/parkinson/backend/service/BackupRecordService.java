package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.response.BackupRecordDto;

import java.util.List;
import java.util.UUID;

public interface BackupRecordService {
    List<BackupRecordDto> findAll();
    void restore(UUID backupId);
}
