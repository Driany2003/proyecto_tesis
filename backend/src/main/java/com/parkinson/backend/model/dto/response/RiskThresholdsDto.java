package com.parkinson.backend.model.dto.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskThresholdsDto {
    private Double lowMax;
    private Double moderateMin;
    private Double moderateMax;
    private Double highMin;
    private Double alertThreshold;
    private Double criticalThreshold;
}
