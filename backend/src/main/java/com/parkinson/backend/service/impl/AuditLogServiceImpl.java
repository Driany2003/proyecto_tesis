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
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogDto> findFiltered(Instant fromDate, Instant toDate, String action, String result, Pageable pageable) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            root.fetch("user", JoinType.LEFT);
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
            query.orderBy(cb.desc(root.get("timestamp")));
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
        return auditLogRepository.findAll(spec, pageable).map(this::toDto);
    }

    @Override
    public byte[] exportCsv(Instant fromDate, Instant toDate, String action, String result) {
        Page<AuditLogDto> page = findFiltered(fromDate, toDate, action, result, Pageable.unpaged());
        StringBuilder sb = new StringBuilder();
        sb.append("timestamp,userName,action,resource,resourceId,result,ip,details\n");
        for (AuditLogDto d : page.getContent()) {
            sb.append(d.getTimestamp().toString()).append(",")
                    .append(escapeCsv(d.getUserName())).append(",")
                    .append(escapeCsv(d.getAction())).append(",")
                    .append(escapeCsv(d.getResource())).append(",")
                    .append(escapeCsv(d.getResourceId())).append(",")
                    .append(escapeCsv(d.getResult())).append(",")
                    .append(escapeCsv(d.getIp())).append(",")
                    .append(escapeCsv(d.getDetails())).append("\n");
        }
        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private AuditLogDto toDto(AuditLog a) {
        return AuditLogDto.builder()
                .id(a.getId())
                .timestamp(a.getTimestamp())
                .userName(a.getUser() != null ? a.getUser().getName() : null)
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
