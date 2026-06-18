package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.response.BackupRecordDto;

import java.util.List;
import java.util.UUID;

public interface BackupRecordService {

    BackupRecordDto createBackup(String triggeredBy);

    List<BackupRecordDto> findAll();

    BackupRecordDto restore(UUID backupId, String triggeredBy);

    void deleteOldBackups();
}
