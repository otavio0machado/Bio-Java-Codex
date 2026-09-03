package com.biodiagnostico.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record UroSedimentRunResponse(
    UUID id,
    LocalDate dataMedicao,
    String patientCode,
    UUID analyst1Id,
    String analyst1Name,
    UUID analyst2Id,
    String analyst2Name,
    Double leukocytesA1,
    Double leukocytesA2,
    Double leukocytesCv,
    String statusLeukocytes,
    Double erythrocytesA1,
    Double erythrocytesA2,
    Double erythrocytesCv,
    String statusErythrocytes,
    String bacteriaA1,
    String bacteriaA2,
    String statusBacteria,
    String epithelialCellsA1,
    String epithelialCellsA2,
    String statusEpithelialCells,
    String mucusThreadsA1,
    String mucusThreadsA2,
    String statusMucusThreads,
    String crystalsA1,
    String crystalsA2,
    String statusCrystals,
    String othersA1,
    String othersA2,
    String statusOthers,
    String statusGeral,
    String correctiveAction,
    String notes,
    Instant createdAt
) {
}
