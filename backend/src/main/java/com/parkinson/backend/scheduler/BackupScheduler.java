package com.parkinson.backend.scheduler;

import com.parkinson.backend.service.BackupRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class BackupScheduler {

    private final BackupRecordService backupService;

    @Scheduled(cron = "${app.backup.schedule:0 0 2 * * *}")
    public void executeScheduledBackup() {
        log.info("Iniciando backup programado...");
        try {
            backupService.createBackup("system_scheduled");
            log.info("Backup programado completado exitosamente");
        } catch (Exception e) {
            log.error("Error en backup programado: {}", e.getMessage(), e);
        }
    }
}
