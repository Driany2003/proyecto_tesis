package com.parkinson.backend.config;

import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
@RequiredArgsConstructor
public class MinioConfig {

    private final MinioProperties minioProperties;

    @Bean
    @Primary
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(minioProperties.getEndpoint())
                .credentials(minioProperties.getAccessKey(), minioProperties.getSecretKey())
                .build();
    }

    /** Cliente con el endpoint público para generar presigned URLs accesibles desde Docker/n8n */
    @Bean("minioPublicClient")
    public MinioClient minioPublicClient() {
        String publicEndpoint = minioProperties.getPublicEndpoint();
        String endpoint = (publicEndpoint != null && !publicEndpoint.isBlank())
                ? publicEndpoint
                : minioProperties.getEndpoint();
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(minioProperties.getAccessKey(), minioProperties.getSecretKey())
                .build();
    }
}
