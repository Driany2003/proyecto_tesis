package com.parkinson.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.minio")
public class MinioProperties {
    private String endpoint = "http://127.0.0.1:9000";
    private String accessKey;
    private String secretKey;
    private String bucket = "parkinsonvoicesdata";
    /** Duración de URLs prefirmadas (GET) en minutos */
    private int presignGetMinutes = 120;
}
