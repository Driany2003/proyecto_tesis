package com.parkinson.backend.service.impl;

import com.parkinson.backend.model.dto.response.RiskThresholdsDto;
import com.parkinson.backend.model.dto.response.ThresholdHistoryDto;
import com.parkinson.backend.model.entity.RiskThreshold;
import com.parkinson.backend.model.entity.ThresholdHistory;
import com.parkinson.backend.model.entity.User;
import com.parkinson.backend.repository.RiskThresholdRepository;
import com.parkinson.backend.repository.ThresholdHistoryRepository;
import com.parkinson.backend.repository.UserRepository;
import com.parkinson.backend.service.RiskThresholdService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RiskThresholdServiceImpl implements RiskThresholdService {

    private final RiskThresholdRepository riskThresholdRepository;
    private final ThresholdHistoryRepository thresholdHistoryRepository;
    private final UserRepository userRepository;

    @Override
    public RiskThresholdsDto getCurrent() {
        return riskThresholdRepository.findFirstByOrderByUpdatedAtDesc()
                .map(this::toDto)
                .orElse(defaultThresholds());
    }

    @Override
    @Transactional
    public RiskThresholdsDto save(RiskThresholdsDto dto, String userEmail) {
        RiskThreshold prev = riskThresholdRepository.findFirstByOrderByUpdatedAtDesc().orElse(null);
        RiskThreshold entity = RiskThreshold.builder()
                .lowMax(dto.getLowMax())
                .moderateMin(dto.getModerateMin())
                .moderateMax(dto.getModerateMax())
                .highMin(dto.getHighMin())
                .alertThreshold(dto.getAlertThreshold())
                .criticalThreshold(dto.getCriticalThreshold())
                .build();
        entity = riskThresholdRepository.save(entity);
        if (prev != null && userEmail != null && !userEmail.isBlank()) {
            User user = userRepository.findByEmail(userEmail).orElse(null);
            if (user != null) {
                ThresholdHistory history = ThresholdHistory.builder()
                        .changedAt(entity.getUpdatedAt())
                        .user(user)
                        .prevLowMax(prev.getLowMax())
                        .prevModerateMin(prev.getModerateMin())
                        .prevModerateMax(prev.getModerateMax())
                        .prevHighMin(prev.getHighMin())
                        .prevAlertThreshold(prev.getAlertThreshold())
                        .nextLowMax(entity.getLowMax())
                        .nextModerateMin(entity.getModerateMin())
                        .nextModerateMax(entity.getModerateMax())
                        .nextHighMin(entity.getHighMin())
                        .nextAlertThreshold(entity.getAlertThreshold())
                        .build();
                thresholdHistoryRepository.save(history);
            }
        }
        return toDto(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ThresholdHistoryDto> getHistory(int limit) {
        return thresholdHistoryRepository.findAllByOrderByChangedAtDesc(PageRequest.of(0, limit))
                .stream()
                .map(this::toHistoryDto)
                .toList();
    }

    private RiskThresholdsDto toDto(RiskThreshold r) {
        return RiskThresholdsDto.builder()
                .lowMax(r.getLowMax())
                .moderateMin(r.getModerateMin())
                .moderateMax(r.getModerateMax())
                .highMin(r.getHighMin())
                .alertThreshold(r.getAlertThreshold())
                .criticalThreshold(r.getCriticalThreshold())
                .build();
    }

    private RiskThresholdsDto defaultThresholds() {
        return RiskThresholdsDto.builder()
                .lowMax(30.0)
                .moderateMin(30.0)
                .moderateMax(60.0)
                .highMin(60.0)
                .alertThreshold(70.0)
                .criticalThreshold(85.0)
                .build();
    }

    private ThresholdHistoryDto toHistoryDto(ThresholdHistory h) {
        return ThresholdHistoryDto.builder()
                .id(h.getId())
                .date(h.getChangedAt())
                .userName(h.getUser().getName())
                .previous(RiskThresholdsDto.builder()
                        .lowMax(h.getPrevLowMax())
                        .moderateMin(h.getPrevModerateMin())
                        .moderateMax(h.getPrevModerateMax())
                        .highMin(h.getPrevHighMin())
                        .alertThreshold(h.getPrevAlertThreshold())
                        .build())
                .next(RiskThresholdsDto.builder()
                        .lowMax(h.getNextLowMax())
                        .moderateMin(h.getNextModerateMin())
                        .moderateMax(h.getNextModerateMax())
                        .highMin(h.getNextHighMin())
                        .alertThreshold(h.getNextAlertThreshold())
                        .build())
                .build();
    }
}
