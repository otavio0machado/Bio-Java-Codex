package com.biodiagnostico.service;

import com.biodiagnostico.dto.request.QcExamRequest;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.exception.ResourceNotFoundException;
import com.biodiagnostico.repository.QcExamRepository;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QcExamService {

    static final String COAGULATION_AREA = "coagulacao";
    private static final Map<String, CoagulationExamSpec> COAGULATION_EXAMS = Map.of(
        "atividade (%)", new CoagulationExamSpec("Atividade (%)", "%"),
        "inr", new CoagulationExamSpec("INR", null),
        "ttpa", new CoagulationExamSpec("TTPA", "s")
    );

    private final QcExamRepository qcExamRepository;

    public QcExamService(QcExamRepository qcExamRepository) {
        this.qcExamRepository = qcExamRepository;
    }

    @Transactional(readOnly = true)
    public List<QcExam> getExams(String area) {
        if (area == null || area.isBlank()) {
            return qcExamRepository.findByIsActiveTrue();
        }
        return qcExamRepository.findByAreaAndIsActiveTrue(area);
    }

    @Transactional
    public QcExam createExam(QcExamRequest request) {
        QcExamRequest normalizedRequest = validateAndNormalizeExam(
            request.area(), request.name(), request.unit()
        );
        ensureNoSemanticDuplicate(normalizedRequest, null);
        return qcExamRepository.save(QcExam.builder()
            .name(normalizedRequest.name())
            .area(normalizedRequest.area())
            .unit(normalizedRequest.unit())
            .isActive(Boolean.TRUE)
            .build());
    }

    @Transactional
    public QcExam updateExam(UUID id, QcExamRequest request) {
        QcExam exam = qcExamRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Exame não encontrado"));
        QcExamRequest normalizedRequest = validateAndNormalizeExam(
            request.area(), request.name(), request.unit()
        );
        if (isProtectedCoagulationExam(exam) && !sameIdentity(exam, normalizedRequest)) {
            throw new BusinessException("Exames canônicos de coagulação não podem ser movidos ou renomeados.");
        }
        ensureNoSemanticDuplicate(normalizedRequest, id);
        exam.setName(normalizedRequest.name());
        exam.setArea(normalizedRequest.area());
        exam.setUnit(normalizedRequest.unit());
        return qcExamRepository.save(exam);
    }

    @Transactional
    public void deleteExam(UUID id) {
        QcExam exam = qcExamRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Exame não encontrado"));
        if (isProtectedCoagulationExam(exam)) {
            throw new BusinessException("Exames canônicos de coagulação não podem ser excluídos.");
        }
        qcExamRepository.deleteById(id);
    }

    static QcExamRequest validateAndNormalizeExam(String area, String name, String unit) {
        if (area == null || area.isBlank() || name == null || name.isBlank()) {
            throw new BusinessException("Área e nome do exame são obrigatórios.");
        }
        String normalizedArea = area.trim();
        if (!COAGULATION_AREA.equalsIgnoreCase(normalizedArea)) {
            return new QcExamRequest(name, area, unit);
        }

        String requestedName = name.trim();
        CoagulationExamSpec spec = COAGULATION_EXAMS.get(requestedName.toLowerCase(Locale.ROOT));
        if (spec == null) {
            throw new BusinessException(
                "A área coagulacao aceita apenas os exames Atividade (%), INR e TTPA."
            );
        }

        String normalizedUnit = normalizeNullable(unit);
        if (spec.unit() == null) {
            if (normalizedUnit != null) {
                throw new BusinessException("O exame INR deve ser cadastrado sem unidade.");
            }
        } else if (!spec.unit().equals(normalizedUnit)) {
            throw new BusinessException(
                "O exame " + spec.name() + " deve usar a unidade " + spec.unit() + "."
            );
        }

        return new QcExamRequest(spec.name(), COAGULATION_AREA, spec.unit());
    }

    private void ensureNoSemanticDuplicate(QcExamRequest request, UUID excludeId) {
        if (!COAGULATION_AREA.equals(request.area())) {
            return;
        }
        boolean duplicate = excludeId == null
            ? qcExamRepository.existsByAreaIgnoreCaseAndNameIgnoreCase(request.area(), request.name())
            : qcExamRepository.existsByAreaIgnoreCaseAndNameIgnoreCaseAndIdNot(
                request.area(), request.name(), excludeId
            );
        if (duplicate) {
            throw new BusinessException("Já existe um exame de coagulação com esta identidade canônica.");
        }
    }

    private boolean isProtectedCoagulationExam(QcExam exam) {
        if (exam == null || exam.getArea() == null || exam.getName() == null) {
            return false;
        }
        return COAGULATION_AREA.equalsIgnoreCase(exam.getArea().trim())
            && COAGULATION_EXAMS.containsKey(exam.getName().trim().toLowerCase(Locale.ROOT));
    }

    private boolean sameIdentity(QcExam exam, QcExamRequest request) {
        return exam.getArea().trim().equalsIgnoreCase(request.area().trim())
            && exam.getName().trim().equalsIgnoreCase(request.name().trim());
    }

    private static String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record CoagulationExamSpec(String name, String unit) {
    }
}
