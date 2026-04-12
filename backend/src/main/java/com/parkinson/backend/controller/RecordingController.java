package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.response.RecordingUploadResponse;
import com.parkinson.backend.service.RecordingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/patients/{patientId}/recordings")
@RequiredArgsConstructor
public class RecordingController {

    private final RecordingService recordingService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RecordingUploadResponse> upload(
            @PathVariable UUID patientId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("durationSeconds") int durationSeconds,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        if (email == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        RecordingUploadResponse body = recordingService.createRecording(patientId, file, durationSeconds, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
