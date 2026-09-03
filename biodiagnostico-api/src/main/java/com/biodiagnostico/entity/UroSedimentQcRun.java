package com.biodiagnostico.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "uro_sediment_qc_runs")
public class UroSedimentQcRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "data_medicao", nullable = false)
    private LocalDate dataMedicao;

    @Column(name = "patient_code", nullable = false, length = 64)
    private String patientCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analyst1_id")
    @JsonIgnore
    private User analyst1;

    @Column(name = "analyst1_name", nullable = false)
    private String analyst1Name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analyst2_id")
    @JsonIgnore
    private User analyst2;

    @Column(name = "analyst2_name", nullable = false)
    private String analyst2Name;

    @Column(name = "leukocytes_a1", nullable = false)
    private Double leukocytesA1;

    @Column(name = "leukocytes_a2", nullable = false)
    private Double leukocytesA2;

    @Column(name = "leukocytes_cv", nullable = false)
    private Double leukocytesCv;

    @Column(name = "status_leukocytes", nullable = false, length = 20)
    private String statusLeukocytes;

    @Column(name = "erythrocytes_a1", nullable = false)
    private Double erythrocytesA1;

    @Column(name = "erythrocytes_a2", nullable = false)
    private Double erythrocytesA2;

    @Column(name = "erythrocytes_cv", nullable = false)
    private Double erythrocytesCv;

    @Column(name = "status_erythrocytes", nullable = false, length = 20)
    private String statusErythrocytes;

    @Column(name = "bacteria_a1", nullable = false, length = 50)
    private String bacteriaA1;

    @Column(name = "bacteria_a2", nullable = false, length = 50)
    private String bacteriaA2;

    @Column(name = "status_bacteria", nullable = false, length = 20)
    private String statusBacteria;

    @Column(name = "epithelial_cells_a1", nullable = false, length = 50)
    private String epithelialCellsA1;

    @Column(name = "epithelial_cells_a2", nullable = false, length = 50)
    private String epithelialCellsA2;

    @Column(name = "status_epithelial_cells", nullable = false, length = 20)
    private String statusEpithelialCells;

    @Column(name = "mucus_threads_a1", nullable = false, length = 50)
    private String mucusThreadsA1;

    @Column(name = "mucus_threads_a2", nullable = false, length = 50)
    private String mucusThreadsA2;

    @Column(name = "status_mucus_threads", nullable = false, length = 20)
    private String statusMucusThreads;

    @Column(name = "crystals_a1", nullable = false, length = 50)
    private String crystalsA1;

    @Column(name = "crystals_a2", nullable = false, length = 50)
    private String crystalsA2;

    @Column(name = "status_crystals", nullable = false, length = 20)
    private String statusCrystals;

    @Column(name = "others_a1", nullable = false, length = 50)
    private String othersA1;

    @Column(name = "others_a2", nullable = false, length = 50)
    private String othersA2;

    @Column(name = "status_others", nullable = false, length = 20)
    private String statusOthers;

    @Column(name = "status_geral", nullable = false, length = 20)
    private String statusGeral;

    @Column(name = "corrective_action", columnDefinition = "TEXT")
    private String correctiveAction;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
