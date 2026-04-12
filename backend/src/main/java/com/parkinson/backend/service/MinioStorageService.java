package com.parkinson.backend.service;

import com.parkinson.backend.config.MinioProperties;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class MinioStorageService {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    public String buildObjectKey(UUID patientId, UUID recordingId, String extension) {
        String ext = extension.startsWith(".") ? extension : "." + extension;
        return String.format("app-recordings/%s/%s%s", patientId, recordingId, ext);
    }

    public void upload(String objectKey, MultipartFile file) throws Exception {
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        try (InputStream is = file.getInputStream()) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .object(objectKey)
                            .stream(is, file.getSize(), -1)
                            .contentType(contentType)
                            .build()
            );
        }
    }

    public String presignedGetUrl(String objectKey) throws Exception {
        return minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                        .method(Method.GET)
                        .bucket(minioProperties.getBucket())
                        .object(objectKey)
                        .expiry(minioProperties.getPresignGetMinutes(), TimeUnit.MINUTES)
                        .build()
        );
    }
}
