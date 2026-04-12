package com.parkinson.backend.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Utilidad para obtener la IP del cliente (considerando proxies y load balancers).
 */
public final class WebUtils {

    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String X_REAL_IP = "X-Real-IP";

    private WebUtils() {
    }

    /**
     * Obtiene la IP del cliente desde la petición (X-Forwarded-For, X-Real-IP o getRemoteAddr).
     */
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
