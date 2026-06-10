package com.biodiagnostico.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "immunology_qc_runs")
public class ImmunologyQcRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "control_set_id", nullable = false)
    @JsonIgnore
    private ImmunologyControlSet controlSet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reagent_lot_id")
    @JsonIgnore
    private ReagentLot reagentLot;

    @Column(name = "data_medicao", nullable = false)
    private LocalDate dataMedicao;

    @Column(name = "analito_snapshot", nullable = false)
    private String analitoSnapshot;

    @Column(name = "manufacturer_snapshot", nullable = false)
    private String manufacturerSnapshot;

    @Column(name = "lot_number_snapshot", nullable = false)
    private String lotNumberSnapshot;

    @Column(name = "valid_until_snapshot", nullable = false)
    private LocalDate validUntilSnapshot;

    @Column(name = "reagent_label_snapshot")
    private String reagentLabelSnapshot;

    @Column(name = "reagent_manufacturer_snapshot")
    private String reagentManufacturerSnapshot;

    @Column(name = "reagent_lot_number_snapshot")
    private String reagentLotNumberSnapshot;

    @Column(name = "reagent_valid_until_snapshot")
    private LocalDate reagentValidUntilSnapshot;

    @Column(name = "reagent_status_snapshot")
    private String reagentStatusSnapshot;

    @Column(name = "reagent_units_in_stock_snapshot")
    private Integer reagentUnitsInStockSnapshot;

    @Column(name = "reagent_units_in_use_snapshot")
    private Integer reagentUnitsInUseSnapshot;

    @Column(name = "reagent_storage_temp_snapshot")
    private String reagentStorageTempSnapshot;

    @Column(name = "reagent_location_snapshot")
    private String reagentLocationSnapshot;

    @Column(nullable = false)
    private String status;

    private String analyst;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Builder.Default
    @OneToMany(mappedBy = "run", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private List<ImmunologyQcRunResult> results = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
