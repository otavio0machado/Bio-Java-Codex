package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.LabReportEmailRequest;
import com.biodiagnostico.dto.request.LabSettingsRequest;
import com.biodiagnostico.dto.response.LabReportEmailResponse;
import com.biodiagnostico.dto.response.LabSettingsResponse;
import com.biodiagnostico.entity.LabReportEmail;
import com.biodiagnostico.entity.LabSettings;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.LabReportEmailRepository;
import com.biodiagnostico.repository.LabSettingsRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LabSettingsService {

    private final LabSettingsRepository labSettingsRepository;
    private final LabReportEmailRepository labReportEmailRepository;

    public LabSettingsService(
        LabSettingsRepository labSettingsRepository,
        LabReportEmailRepository labReportEmailRepository
    ) {
        this.labSettingsRepository = labSettingsRepository;
        this.labReportEmailRepository = labReportEmailRepository;
    }

    @Transactional
    public LabSettings getOrCreateSingleton() {
        return labSettingsRepository.findSingleton().orElseGet(() -> {
            LabSettings fresh = LabSettings.builder().build();
            return labSettingsRepository.save(fresh);
        });
    }

    @Transactional(readOnly = true)
    public LabSettingsResponse getSettings() {
        LabSettings settings = labSettingsRepository.findSingleton()
            .orElseGet(() -> LabSettings.builder().build());
        return toResponse(settings);
    }

    @Transactional
    public LabSettingsResponse updateSettings(LabSettingsRequest request) {
        LabSettings settings = getOrCreateSingleton();
        settings.setLabName(nullToEmpty(request.labName()));
        settings.setResponsibleName(nullToEmpty(request.responsibleName()));
        settings.setResponsibleRegistration(nullToEmpty(request.responsibleRegistration()));
        settings.setAddress(nullToEmpty(request.address()));
        settings.setPhone(nullToEmpty(request.phone()));
        settings.setEmail(nullToEmpty(request.email()));
        return toResponse(labSettingsRepository.save(settings));
    }

    @Transactional(readOnly = true)
    public List<LabReportEmailResponse> listEmails() {
        return labReportEmailRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<LabReportEmail> activeRecipients() {
        return labReportEmailRepository.findByIsActiveTrueOrderByEmailAsc();
    }

    @Transactional
    public LabReportEmailResponse addEmail(LabReportEmailRequest request) {
        if (request.email() == null || request.email().isBlank()) {
            throw new BusinessException("E-mail obrigatório.");
        }
        String normalized = request.email().trim().toLowerCase();
        labReportEmailRepository.findAll().stream()
            .filter(entry -> entry.getEmail().equalsIgnoreCase(normalized))
            .findFirst()
            .ifPresent(existing -> {
                throw new BusinessException("E-mail já cadastrado.");
            });
        LabReportEmail entity = LabReportEmail.builder()
            .email(normalized)
            .name(request.name() != null ? request.name() : "")
            .isActive(request.isActive() == null ? Boolean.TRUE : request.isActive())
            .build();
        return toResponse(labReportEmailRepository.save(entity));
    }

    @Transactional
    public void removeEmail(UUID id) {
        if (!labReportEmailRepository.existsById(id)) {
            throw new ResourceNotFoundException("E-mail não encontrado.");
        }
        labReportEmailRepository.deleteById(id);
    }

    @Transactional
    public LabReportEmailResponse setEmailActive(UUID id, boolean active) {
        LabReportEmail entity = labReportEmailRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("E-mail não encontrado."));
        entity.setIsActive(active);
        return toResponse(labReportEmailRepository.save(entity));
    }

    private LabSettingsResponse toResponse(LabSettings settings) {
        return new LabSettingsResponse(
            settings.getLabName(),
            settings.getResponsibleName(),
            settings.getResponsibleRegistration(),
            settings.getAddress(),
            settings.getPhone(),
            settings.getEmail()
        );
    }

    private LabReportEmailResponse toResponse(LabReportEmail entity) {
        return new LabReportEmailResponse(
            entity.getId(),
            entity.getEmail(),
            entity.getName(),
            entity.getIsActive()
        );
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
