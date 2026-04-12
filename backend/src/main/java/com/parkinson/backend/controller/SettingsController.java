package com.parkinson.backend.controller;

import com.parkinson.backend.model.dto.response.RiskThresholdsDto;
import com.parkinson.backend.model.dto.response.ThresholdHistoryDto;
import com.parkinson.backend.service.RiskThresholdService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final RiskThresholdService riskThresholdService;

    @GetMapping("/risk-thresholds")
    public RiskThresholdsDto getRiskThresholds() {
        return riskThresholdService.getCurrent();
    }

    @PutMapping("/risk-thresholds")
    public RiskThresholdsDto saveRiskThresholds(
            @RequestBody RiskThresholdsDto dto,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String userEmail = userDetails != null ? userDetails.getUsername() : null;
        return riskThresholdService.save(dto, userEmail);
    }

    @GetMapping("/risk-thresholds/history")
    public List<ThresholdHistoryDto> getThresholdHistory(@RequestParam(defaultValue = "50") int limit) {
        return riskThresholdService.getHistory(limit);
    }
}
