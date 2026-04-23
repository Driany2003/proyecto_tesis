package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.request.RecordingNotesPatchRequest;
import com.parkinson.backend.model.dto.response.RecordingAudioUrlDto;
import com.parkinson.backend.model.dto.response.RecordingListItemDto;
import com.parkinson.backend.model.dto.response.RecordingSummaryDto;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/patients/{patientId}/recordings")
@RequiredArgsConstructor
public class RecordingController {

    private final RecordingService recordingService;

    @GetMapping
    public ResponseEntity<List<RecordingSummaryDto>> list(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        requireAuth(userDetails);
        return ResponseEntity.ok(recordingService.listByPatient(patientId));
    }

    @GetMapping("/{recordingId}")
    public ResponseEntity<RecordingListItemDto> getOne(
            @PathVariable UUID patientId,
            @PathVariable UUID recordingId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        requireAuth(userDetails);
        return ResponseEntity.ok(recordingService.getByIdForPatient(patientId, recordingId));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RecordingUploadResponse> upload(
            @PathVariable UUID patientId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("durationSeconds") int durationSeconds,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = requireAuth(userDetails).getUsername();
        RecordingUploadResponse body = recordingService.createRecording(patientId, file, durationSeconds, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{recordingId}/audio-url")
    public ResponseEntity<RecordingAudioUrlDto> getAudioUrl(
            @PathVariable UUID patientId,
            @PathVariable UUID recordingId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        requireAuth(userDetails);
        return ResponseEntity.ok(recordingService.getAudioUrl(patientId, recordingId));
    }

    @PatchMapping(value = "/{recordingId}/notes", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<RecordingListItemDto> patchNotes(
            @PathVariable UUID patientId,
            @PathVariable UUID recordingId,
            @RequestBody RecordingNotesPatchRequest body,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        requireAuth(userDetails);
        return ResponseEntity.ok(recordingService.patchNotes(patientId, recordingId, body));
    }

    private static UserDetails requireAuth(UserDetails userDetails) {
        if (userDetails == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return userDetails;
    }
}
