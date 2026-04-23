package com.parkinson.backend.service.impl;

import com.parkinson.backend.exception.ResourceNotFoundException;
import com.parkinson.backend.model.dto.response.BackupRecordDto;
import com.parkinson.backend.model.entity.BackupRecord;
import com.parkinson.backend.repository.BackupRecordRepository;
import com.parkinson.backend.service.BackupRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BackupRecordServiceImpl implements BackupRecordService {

    private final BackupRecordRepository backupRecordRepository;

    @Override
    public List<BackupRecordDto> findAll() {
        return backupRecordRepository.findAllByOrderByBackupDateDesc().stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    public void restore(UUID backupId) {
        if (!backupRecordRepository.existsById(backupId)) {
            throw new ResourceNotFoundException("Respaldo", backupId);
        }
    }

    private BackupRecordDto toDto(BackupRecord b) {
        return BackupRecordDto.builder()
                .id(b.getId())
                .date(b.getBackupDate())
                .sizeBytes(b.getSizeBytes())
                .durationSeconds(b.getDurationSeconds())
                .status(b.getStatus())
                .integrityHash(b.getIntegrityHash())
                .build();
    }
}
