package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.request.RecordingNotesPatchRequest;
import com.parkinson.backend.model.dto.request.RecordingStatusWebhookRequest;
import com.parkinson.backend.model.dto.response.RecordingAudioUrlDto;
import com.parkinson.backend.model.dto.response.RecordingListItemDto;
import com.parkinson.backend.model.dto.response.RecordingSummaryDto;
import com.parkinson.backend.model.dto.response.RecordingUploadResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface RecordingService {

    RecordingUploadResponse createRecording(UUID patientId,
                                            MultipartFile file,
                                            int durationSeconds,
                                            String userEmail);

    List<RecordingSummaryDto> listByPatient(UUID patientId);

    RecordingListItemDto getByIdForPatient(UUID patientId, UUID recordingId);

    RecordingAudioUrlDto getAudioUrl(UUID patientId, UUID recordingId);

    RecordingListItemDto patchNotes(UUID patientId,
                                    UUID recordingId,
                                    RecordingNotesPatchRequest body);

    void updateRecordingFromPipelineWebhook(String headerSecret,
                                            RecordingStatusWebhookRequest body);
}
