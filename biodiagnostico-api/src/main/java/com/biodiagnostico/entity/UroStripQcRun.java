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
@Table(name = "uro_strip_qc_runs")
public class UroStripQcRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "control_set_id", nullable = false)
    @JsonIgnore
    private UroStripControlSet controlSet;

    @Column(name = "data_medicao", nullable = false)
    private LocalDate dataMedicao;

    @Column(name = "control_lot_snapshot", nullable = false)
    private String controlLotSnapshot;

    @Column(name = "control_valid_until_snapshot", nullable = false)
    private LocalDate controlValidUntilSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reagent_lot_id")
    @JsonIgnore
    private ReagentLot reagentLot;

    @Column(name = "reagent_label_snapshot")
    private String reagentLabelSnapshot;

    @Column(name = "reagent_manufacturer_snapshot")
    private String reagentManufacturerSnapshot;

    @Column(name = "reagent_lot_number_snapshot")
    private String reagentLotNumberSnapshot;

    @Column(name = "reagent_valid_until_snapshot")
    private LocalDate reagentValidUntilSnapshot;

    @Column(name = "measured_ph")
    private Double measuredPh;

    @Column(name = "status_ph", nullable = false)
    private String statusPh;

    @Column(name = "measured_density")
    private Double measuredDensity;

    @Column(name = "status_density", nullable = false)
    private String statusDensity;

    @Column(name = "measured_proteins", nullable = false)
    private String measuredProteins;

    @Column(name = "status_proteins", nullable = false)
    private String statusProteins;

    @Column(name = "measured_glucose", nullable = false)
    private String measuredGlucose;

    @Column(name = "status_glucose", nullable = false)
    private String statusGlucose;

    @Column(name = "measured_ketones", nullable = false)
    private String measuredKetones;

    @Column(name = "status_ketones", nullable = false)
    private String statusKetones;

    @Column(name = "measured_blood", nullable = false)
    private String measuredBlood;

    @Column(name = "status_blood", nullable = false)
    private String statusBlood;

    @Column(name = "measured_urobilinogen", nullable = false)
    private String measuredUrobilinogen;

    @Column(name = "status_urobilinogen", nullable = false)
    private String statusUrobilinogen;

    @Column(name = "measured_nitrite", nullable = false)
    private String measuredNitrite;

    @Column(name = "status_nitrite", nullable = false)
    private String statusNitrite;

    @Column(name = "status_geral", nullable = false)
    private String statusGeral;

    @Column(name = "corrective_action", columnDefinition = "TEXT")
    private String correctiveAction;

    @Column(name = "analyst")
    private String analyst;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
