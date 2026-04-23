package com.parkinson.backend.context;

import com.parkinson.backend.util.WebUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

@Component
@RequestScope
@RequiredArgsConstructor
public class RequestContext {

    private final HttpServletRequest request;

    public String getClientIp() {
        return WebUtils.getClientIp(request);
    }

    public String getCurrentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        String name = auth.getName();
        return (name == null || name.isBlank() || "anonymousUser".equals(name)) ? null : name;
    }
}
