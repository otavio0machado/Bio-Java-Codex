package com.biodiagnostico.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record UroSedimentRunRequest(
    @NotNull(message = "Data da medição é obrigatória")
    LocalDate dataMedicao,

    @NotBlank(message = "Código do paciente/amostra é obrigatório")
    String patientCode,

    UUID analyst1Id,
    String analyst1Name,

    UUID analyst2Id,
    String analyst2Name,

    @NotNull(message = "Contagem de leucócitos do Analista 1 é obrigatória")
    Double leukocytesA1,

    @NotNull(message = "Contagem de leucócitos do Analista 2 é obrigatória")
    Double leukocytesA2,

    @NotNull(message = "Contagem de hemácias do Analista 1 é obrigatória")
    Double erythrocytesA1,

    @NotNull(message = "Contagem de hemácias do Analista 2 é obrigatória")
    Double erythrocytesA2,

    @NotBlank(message = "Avaliação de bactérias do Analista 1 é obrigatória")
    String bacteriaA1,

    @NotBlank(message = "Avaliação de bactérias do Analista 2 é obrigatória")
    String bacteriaA2,

    @NotBlank(message = "Avaliação de células epiteliais do Analista 1 é obrigatória")
    String epithelialCellsA1,

    @NotBlank(message = "Avaliação de células epiteliais do Analista 2 é obrigatória")
    String epithelialCellsA2,

    @NotBlank(message = "Avaliação de filamento de muco do Analista 1 é obrigatória")
    String mucusThreadsA1,

    @NotBlank(message = "Avaliação de filamento de muco do Analista 2 é obrigatória")
    String mucusThreadsA2,

    @NotBlank(message = "Avaliação de cristais do Analista 1 é obrigatória")
    String crystalsA1,

    @NotBlank(message = "Avaliação de cristais do Analista 2 é obrigatória")
    String crystalsA2,

    @NotBlank(message = "Avaliação de outros elementos do Analista 1 é obrigatória")
    String othersA1,

    @NotBlank(message = "Avaliação de outros elementos do Analista 2 é obrigatória")
    String othersA2,

    String correctiveAction,
    String notes,
    Double maxCv,
    Double leukocytesCv,
    Double erythrocytesCv
) {
    public UroSedimentRunRequest(
        LocalDate dataMedicao,
        String patientCode,
        UUID analyst1Id,
        String analyst1Name,
        UUID analyst2Id,
        String analyst2Name,
        Double leukocytesA1,
        Double leukocytesA2,
        Double erythrocytesA1,
        Double erythrocytesA2,
        String bacteriaA1,
        String bacteriaA2,
        String epithelialCellsA1,
        String epithelialCellsA2,
        String mucusThreadsA1,
        String mucusThreadsA2,
        String crystalsA1,
        String crystalsA2,
        String othersA1,
        String othersA2,
        String correctiveAction,
        String notes
    ) {
        this(dataMedicao, patientCode, analyst1Id, analyst1Name, analyst2Id, analyst2Name,
             leukocytesA1, leukocytesA2, erythrocytesA1, erythrocytesA2,
             bacteriaA1, bacteriaA2, epithelialCellsA1, epithelialCellsA2,
             mucusThreadsA1, mucusThreadsA2, crystalsA1, crystalsA2,
             othersA1, othersA2, correctiveAction, notes, null, null, null);
    }
}
