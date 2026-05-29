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
