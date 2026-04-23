package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.response.AuditLogDto;
import com.parkinson.backend.model.entity.User;
import org.springframework.data.domain.Page;

import java.time.LocalDate;

public interface AuditLogService {
    Page<AuditLogDto> findFiltered(LocalDate fromDate, LocalDate toDate, String action, String result);
    byte[] exportCsv(LocalDate fromDate, LocalDate toDate, String action, String result);

    void log(User user, String action, String resource, String resourceId, String result, String clientIp, String details);
}
