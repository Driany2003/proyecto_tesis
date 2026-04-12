package com.parkinson.backend.model.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ThresholdHistoryDto {
    private UUID id;
    private Instant date;
    private String userName;
    private RiskThresholdsDto previous;
    private RiskThresholdsDto next;
}
