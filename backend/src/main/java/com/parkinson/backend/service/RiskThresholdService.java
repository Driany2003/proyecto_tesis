package com.parkinson.backend.service;

import com.parkinson.backend.model.dto.response.RiskThresholdsDto;
import com.parkinson.backend.model.dto.response.ThresholdHistoryDto;

import java.util.List;

public interface RiskThresholdService {
    RiskThresholdsDto getCurrent();
    RiskThresholdsDto save(RiskThresholdsDto dto, String userEmail);
    List<ThresholdHistoryDto> getHistory(int limit);
}
