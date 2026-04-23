package com.parkinson.backend.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface MinioStorageService {

    String buildObjectKey(UUID patientId, UUID recordingId, String extension);

    void upload(String objectKey, MultipartFile file);

    String presignedGetUrl(String objectKey);
}
