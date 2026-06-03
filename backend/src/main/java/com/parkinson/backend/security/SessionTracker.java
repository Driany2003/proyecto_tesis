package com.parkinson.backend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
public class SessionTracker {

    private static final long MAX_INACTIVITY_MINUTES = 30;
    private static final long SESSION_MAX_LIFETIME_MINUTES = 120;

    private final ConcurrentHashMap<String, Instant> activeSessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Instant> lastActivity = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> userActiveToken = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Long>> ipRateBuckets = new ConcurrentHashMap<>();

    public void registerSession(String token, String email) {
        invalidatePreviousSession(email);
        Instant now = Instant.now();
        activeSessions.put(token, now);
        lastActivity.put(token, now);
        userActiveToken.put(email, token);
        cleanupExpired();
    }

    public boolean isSessionValid(String token) {
        Instant started = activeSessions.get(token);
        if (started == null) return false;
        if (Instant.now().isAfter(started.plusSeconds(SESSION_MAX_LIFETIME_MINUTES * 60))) {
            removeSession(token);
            return false;
        }
        return true;
    }

    public boolean isSessionInactive(String token) {
        Instant last = lastActivity.get(token);
        if (last == null) return false;
        return Instant.now().isAfter(last.plusSeconds(MAX_INACTIVITY_MINUTES * 60));
    }

    public void recordActivity(String token) {
        if (activeSessions.containsKey(token)) {
            lastActivity.put(token, Instant.now());
        }
    }

    public void removeSession(String token) {
        activeSessions.remove(token);
        lastActivity.remove(token);
        Iterator<Map.Entry<String, String>> it = userActiveToken.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, String> entry = it.next();
            if (entry.getValue().equals(token)) {
                it.remove();
                break;
            }
        }
    }

    public void invalidatePreviousSession(String email) {
        String previousToken = userActiveToken.get(email);
        if (previousToken != null) {
            activeSessions.remove(previousToken);
            lastActivity.remove(previousToken);
            userActiveToken.remove(email);
        }
    }

    public boolean isRateLimited(String ip, String endpoint) {
        String key = ip + ":" + endpoint;
        long now = System.currentTimeMillis();
        int maxRequests = endpoint.equals("login") ? 5 : 100;
        int windowMs = 60_000;

        Deque<Long> timestamps = ipRateBuckets.computeIfAbsent(key, k -> new ArrayDeque<>(maxRequests));
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > windowMs) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests) {
                return true;
            }
            timestamps.offerLast(now);
            return false;
        }
    }

    public void recordRateLimited(String ip, String endpoint) {
        log.warn("Rate limit alcanzado: ip={} endpoint={}", ip, endpoint);
    }

    private void cleanupExpired() {
        Instant cutoff = Instant.now().minusSeconds(SESSION_MAX_LIFETIME_MINUTES * 60 + 300);
        Iterator<Map.Entry<String, Instant>> it = activeSessions.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Instant> entry = it.next();
            if (entry.getValue().isBefore(cutoff)) {
                removeSession(entry.getKey());
            }
        }
    }
}
