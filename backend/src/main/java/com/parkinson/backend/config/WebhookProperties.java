package com.parkinson.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.webhook")
public class WebhookProperties {
    private String recordingSecret = "";
}
