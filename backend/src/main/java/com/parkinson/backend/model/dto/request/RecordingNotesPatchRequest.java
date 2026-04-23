package com.parkinson.backend.model.dto.request;

public record RecordingNotesPatchRequest(
        String noteConsiderations,
        String noteAnnotations,
        String noteComplications
) {}
