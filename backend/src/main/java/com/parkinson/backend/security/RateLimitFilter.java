package com.parkinson.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private static final class Tier {
        final int maxRequests;
        final int windowSeconds;
        Tier(int maxRequests, int windowSeconds) {
            this.maxRequests = maxRequests;
            this.windowSeconds = windowSeconds;
        }
    }

    private static final Map<Pattern, Tier> ENDPOINT_TIERS = Map.ofEntries(
            Map.entry(Pattern.compile(".*/auth/login"),              new Tier(5, 60)),
            Map.entry(Pattern.compile(".*/patients/.*/recordings$"), new Tier(30, 60)),
            Map.entry(Pattern.compile(".*/webhooks/.*"),             new Tier(30, 60)),
            Map.entry(Pattern.compile(".*/audit-logs/export"),       new Tier(5, 60)),
            Map.entry(Pattern.compile(".*/audit-logs"),              new Tier(30, 60)),
            Map.entry(Pattern.compile(".*/users"),                   new Tier(20, 60)),
            Map.entry(Pattern.compile(".*/settings/.*"),             new Tier(10, 60)),
            Map.entry(Pattern.compile(".*/backups/restore"),         new Tier(3, 60)),
            Map.entry(Pattern.compile(".*/backups"),                 new Tier(10, 60)),
            Map.entry(Pattern.compile(".*/patients"),                new Tier(60, 60)),
            Map.entry(Pattern.compile(".*/recordings"),              new Tier(30, 60)),
            Map.entry(Pattern.compile(".*/auth/me"),                 new Tier(60, 60)),
            Map.entry(Pattern.compile(".*/auth/logout"),             new Tier(30, 60))
    );

    private static final Tier DEFAULT_TIER = new Tier(100, 60);

    private final ConcurrentHashMap<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String ip = getClientIp(request);
        String path = request.getRequestURI();

        Tier tier = resolveTier(path);
        String key = ip + ":" + hashEndpoint(path);

        if (checkRateLimit(key, tier)) {
            log.warn("Rate limit excedido: ip={} endpoint={} limit={}/{}s", ip, path, tier.maxRequests, tier.windowSeconds);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                "{\"error\":\"Demasiadas solicitudes. Límite: " + tier.maxRequests
                + " por " + tier.windowSeconds + "s. Espere e intente de nuevo.\"}"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Tier resolveTier(String path) {
        for (Map.Entry<Pattern, Tier> entry : ENDPOINT_TIERS.entrySet()) {
            if (entry.getKey().matcher(path).matches()) {
                return entry.getValue();
            }
        }
        return DEFAULT_TIER;
    }

    private String hashEndpoint(String path) {
        return path.replaceAll("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "{id}")
                .replaceAll("\\d{7,}", "{num}");
    }

    private boolean checkRateLimit(String key, Tier tier) {
        long now = System.currentTimeMillis();
        long windowMs = tier.windowSeconds * 1000L;

        Deque<Long> timestamps = buckets.computeIfAbsent(key, k -> new ArrayDeque<>(tier.maxRequests));
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > windowMs) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= tier.maxRequests) {
                return true;
            }
            timestamps.offerLast(now);
            return false;
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
