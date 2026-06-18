package com.parkinson.backend.service.impl;

import com.parkinson.backend.exception.BackupException;
import com.parkinson.backend.exception.BadRequestException;
import com.parkinson.backend.exception.ResourceNotFoundException;
import com.parkinson.backend.model.dto.response.BackupRecordDto;
import com.parkinson.backend.model.entity.BackupRecord;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.BackupRecordRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.service.AuditLogService;
import com.parkinson.backend.service.BackupRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BackupRecordServiceImpl implements BackupRecordService {

    private final BackupRecordRepository backupRecordRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @Value("${app.backup.pg_dump-path:/usr/bin/pg_dump}")
    private String pgDumpPath;

    @Value("${app.backup.pg_restore-path:/usr/bin/pg_restore}")
    private String pgRestorePath;

    @Value("${app.backup.storage-path:/var/backups/parkinson}")
    private String storagePath;

    @Value("${app.backup.retention-days:30}")
    private int retentionDays;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @Value("${spring.datasource.username}")
    private String dbUsername;

    @Value("${spring.datasource.password}")
    private String dbPassword;

    @Override
    @Transactional
    public BackupRecordDto createBackup(String triggeredBy) {
        Instant start = Instant.now();
        String filename = "parkinson_backup_" + start.getEpochSecond() + ".sql";

        try {
            Path backupDir = Paths.get(storagePath);
            Files.createDirectories(backupDir);
            Path backupPath = backupDir.resolve(filename);

            executePgDump(backupPath);

            String hash = calculateSha256(backupPath);
            long sizeBytes = Files.size(backupPath);
            int durationSeconds = (int) (Instant.now().getEpochSecond() - start.getEpochSecond());

            BackupRecord record = BackupRecord.builder()
                    .backupDate(start)
                    .sizeBytes(sizeBytes)
                    .durationSeconds(durationSeconds)
                    .status("success")
                    .integrityHash(hash)
                    .build();
            backupRecordRepository.save(record);

            User user = userRepository.findByEmail(triggeredBy).orElse(null);
            auditLogService.log(user, "BACKUP_CREATE", "backup", record.getId().toString(),
                    "SUCCESS", null, "Backup creado: " + filename + ", tamaño: " + sizeBytes + " bytes");

            deleteOldBackups();

            log.info("Backup creado exitosamente: {}, tamaño: {} bytes", filename, sizeBytes);
            return toDto(record);

        } catch (IOException e) {
            throw new BackupException("Error al crear backup: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<BackupRecordDto> findAll() {
        return backupRecordRepository.findAllByOrderByBackupDateDesc().stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public BackupRecordDto restore(UUID backupId, String triggeredBy) {
        BackupRecord record = backupRecordRepository.findById(backupId)
                .orElseThrow(() -> new ResourceNotFoundException("Backup", backupId));

        if (!"success".equals(record.getStatus())) {
            throw new BadRequestException("No se puede restaurar backup con estado: " + record.getStatus());
        }

        Path backupPath = resolveBackupPath(record);
        if (!Files.exists(backupPath)) {
            throw new BackupException("Archivo de backup no encontrado en disco");
        }

        try {
            String currentHash = calculateSha256(backupPath);
            if (!currentHash.equals(record.getIntegrityHash())) {
                throw new BackupException("El backup está corrupto (hash de integridad no coincide)");
            }

            executePgRestore(backupPath);

            User user = userRepository.findByEmail(triggeredBy).orElse(null);
            auditLogService.log(user, "BACKUP_RESTORE", "backup", backupId.toString(),
                    "SUCCESS", null, "Backup restaurado: " + record.getBackupDate());

            log.info("Backup restaurado exitosamente: {}", backupId);
            return toDto(record);

        } catch (IOException e) {
            throw new BackupException("Error al restaurar backup: " + e.getMessage(), e);
        }
    }

    @Override
    public void deleteOldBackups() {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        List<BackupRecord> oldBackups = backupRecordRepository.findAll().stream()
                .filter(b -> b.getBackupDate().isBefore(cutoff))
                .toList();

        for (BackupRecord backup : oldBackups) {
            try {
                Path path = resolveBackupPath(backup);
                Files.deleteIfExists(path);
                backupRecordRepository.delete(backup);
                log.info("Backup antiguo eliminado: {}", backup.getId());
            } catch (IOException e) {
                log.warn("Error eliminando archivo de backup {}: {}", backup.getId(), e.getMessage());
            }
        }
    }

    private void executePgDump(Path outputPath) throws IOException {
        List<String> cmd = buildPgDumpCommand(outputPath);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.environment().put("PGPASSWORD", dbPassword);
        pb.redirectErrorStream(false);

        try {
            Process process = pb.start();
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                String error = new String(process.getErrorStream().readAllBytes());
                throw new BackupException("pg_dump falló con código " + exitCode + ": " + error);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BackupException("pg_dump interrumpido", e);
        }
    }

    private void executePgRestore(Path backupPath) throws IOException {
        List<String> cmd = buildPgRestoreCommand(backupPath);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.environment().put("PGPASSWORD", dbPassword);
        pb.redirectErrorStream(false);

        try {
            Process process = pb.start();
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                String error = new String(process.getErrorStream().readAllBytes());
                throw new BackupException("pg_restore falló con código " + exitCode + ": " + error);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BackupException("pg_restore interrumpido", e);
        }
    }

    private List<String> buildPgDumpCommand(Path outputPath) {
        String[] urlParts = parseJdbcUrl();
        List<String> cmd = new ArrayList<>();
        cmd.add(pgDumpPath);
        cmd.add("-h");
        cmd.add(urlParts[0]);
        cmd.add("-p");
        cmd.add(urlParts[1]);
        cmd.add("-U");
        cmd.add(dbUsername);
        cmd.add("-d");
        cmd.add(urlParts[2]);
        cmd.add("-F");
        cmd.add("c");
        cmd.add("-f");
        cmd.add(outputPath.toString());
        return cmd;
    }

    private List<String> buildPgRestoreCommand(Path backupPath) {
        String[] urlParts = parseJdbcUrl();
        List<String> cmd = new ArrayList<>();
        cmd.add(pgRestorePath);
        cmd.add("-h");
        cmd.add(urlParts[0]);
        cmd.add("-p");
        cmd.add(urlParts[1]);
        cmd.add("-U");
        cmd.add(dbUsername);
        cmd.add("-d");
        cmd.add(urlParts[2]);
        cmd.add("-c");
        cmd.add("--if-exists");
        cmd.add(backupPath.toString());
        return cmd;
    }

    private String[] parseJdbcUrl() {
        String url = datasourceUrl.replace("jdbc:postgresql://", "");
        String host = url.split(":")[0];
        String portDb = url.split(":")[1];
        String port = portDb.split("/")[0];
        String database = portDb.split("/")[1];
        return new String[]{host, port, database};
    }

    private String calculateSha256(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] fileBytes = Files.readAllBytes(path);
            byte[] hashBytes = digest.digest(fileBytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new BackupException("Error calculando hash SHA-256: " + e.getMessage(), e);
        }
    }

    private Path resolveBackupPath(BackupRecord record) {
        String filename = "parkinson_backup_" + record.getBackupDate().getEpochSecond() + ".sql";
        return Paths.get(storagePath, filename);
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
