package com.parkinson.backend.service.impl;

import com.parkinson.backend.model.dto.response.AuditLogDto;
import com.parkinson.backend.model.entity.AuditLog;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.AuditLogRepository;
import com.parkinson.backend.service.AuditLogService;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Override
    @Transactional
    public void log(User user, String action, String resource, String resourceId, String result, String clientIp, String details) {
        AuditLog log = AuditLog.builder()
                .timestamp(Instant.now())
                .user(user)
                .action(action)
                .resource(resource)
                .resourceId(resourceId != null ? (resourceId.length() > 100 ? resourceId.substring(0, 100) : resourceId) : null)
                .result(result != null && result.length() > 20 ? result.substring(0, 20) : result)
                .ip(clientIp != null && clientIp.length() > 45 ? clientIp.substring(0, 45) : clientIp)
                .details(details != null && details.length() > 2000 ? details.substring(0, 2000) : details)
                .build();
        auditLogRepository.save(log);
    }

    private static final int MAX_PAGE_SIZE = 500;

    private static Instant toStartOfDay(LocalDate date) {
        return date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static Instant toEndOfDay(LocalDate date) {
        return date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogDto> findFiltered(LocalDate fromDate, LocalDate toDate, String action, String result,
                                          UUID userId, String resource) {
        Instant from = fromDate != null ? toStartOfDay(fromDate) : null;
        Instant to   = toDate   != null ? toEndOfDay(toDate)     : null;
        return findFiltered(from, to, action, result, userId, resource, PageRequest.of(0, MAX_PAGE_SIZE));
    }

    private Page<AuditLogDto> findFiltered(Instant fromDate, Instant toDate, String action, String result,
                                           UUID userId, String resource, Pageable pageable) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            root.fetch("user", JoinType.LEFT);
            root.fetch("user").fetch("role", JoinType.LEFT);
            List<Predicate> predicates = new ArrayList<>();
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), fromDate));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("timestamp"), toDate));
            }
            if (action != null && !action.isBlank()) {
                String pattern = "%" + action.trim().toLowerCase() + "%";
                predicates.add(cb.like(cb.lower(root.get("action")), pattern));
            }
            if (result != null && !result.isBlank()) {
                predicates.add(cb.equal(root.get("result"), result));
            }
            if (userId != null) {
                predicates.add(cb.equal(root.get("user").get("id"), userId));
            }
            if (resource != null && !resource.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("resource")), "%" + resource.trim().toLowerCase() + "%"));
            }
            query.orderBy(cb.desc(root.get("timestamp")));
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
        return auditLogRepository.findAll(spec, pageable).map(this::toDto);
    }

    @Override
    public byte[] exportCsv(LocalDate fromDate, LocalDate toDate, String action, String result) {
        Instant from = fromDate != null ? toStartOfDay(fromDate) : null;
        Instant to   = toDate   != null ? toEndOfDay(toDate)     : null;
        StringBuilder sb = new StringBuilder();
        sb.append("timestamp,userId,userName,userEmail,userRole,action,resource,resourceId,result,ip,details\n");
        int pageSize = 500;
        int page = 0;
        boolean hasMore = true;
        while (hasMore) {
            Page<AuditLogDto> resultPage = findFiltered(from, to, action, result, null, null, PageRequest.of(page, pageSize));
            for (AuditLogDto d : resultPage.getContent()) {
                sb.append(d.getTimestamp().toString()).append(",")
                        .append(d.getUserId() != null ? d.getUserId().toString() : "").append(",")
                        .append(escapeCsv(d.getUserName())).append(",")
                        .append(escapeCsv(d.getUserEmail())).append(",")
                        .append(escapeCsv(d.getUserRole())).append(",")
                        .append(escapeCsv(d.getAction())).append(",")
                        .append(escapeCsv(d.getResource())).append(",")
                        .append(escapeCsv(d.getResourceId())).append(",")
                        .append(escapeCsv(d.getResult())).append(",")
                        .append(escapeCsv(d.getIp())).append(",")
                        .append(escapeCsv(d.getDetails())).append("\n");
            }
            hasMore = resultPage.hasNext();
            page++;
            if (page > 40) break;
        }
        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private AuditLogDto toDto(AuditLog a) {
        return AuditLogDto.builder()
                .id(a.getId())
                .timestamp(a.getTimestamp())
                .userId(a.getUser() != null ? a.getUser().getId() : null)
                .userName(a.getUser() != null ? a.getUser().getName() : null)
                .userEmail(a.getUser() != null ? a.getUser().getEmail() : null)
                .userRole(a.getUser() != null && a.getUser().getRole() != null
                        ? a.getUser().getRole().getName() : null)
                .action(a.getAction())
                .resource(a.getResource())
                .resourceId(a.getResourceId())
                .result(a.getResult())
                .ip(a.getIp())
                .details(a.getDetails())
                .build();
    }

    private static String escapeCsv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
