package com.parkinson.backend.util;

import jakarta.servlet.http.HttpServletRequest;

public final class WebUtils {

    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String X_REAL_IP = "X-Real-IP";

    private WebUtils() {}

    public static String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String xff = request.getHeader(X_FORWARDED_FOR);
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String xri = request.getHeader(X_REAL_IP);
        if (xri != null && !xri.isBlank()) {
            return xri.trim();
        }
        return request.getRemoteAddr();
    }
}
