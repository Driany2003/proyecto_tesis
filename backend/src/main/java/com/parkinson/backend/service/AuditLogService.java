package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.response.AuditLogDto;
import com.parkinson.backend.model.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;

public interface AuditLogService {
    Page<AuditLogDto> findFiltered(Instant fromDate, Instant toDate, String action, String result, Pageable pageable);
    byte[] exportCsv(Instant fromDate, Instant toDate, String action, String result);

    /**
     * Registra una acción en el log de auditoría (quién, cuándo, IP, acción, recurso, resultado).
     */
    void log(User user, String action, String resource, String resourceId, String result, String clientIp, String details);
}
