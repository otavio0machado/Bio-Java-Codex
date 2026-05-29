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
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "immunology_qc_run_results")
public class ImmunologyQcRunResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "run_id", nullable = false)
    @JsonIgnore
    private ImmunologyQcRun run;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "control_item_id")
    @JsonIgnore
    private ImmunologyControlItem controlItem;

    @Column(name = "control_name_snapshot", nullable = false)
    private String controlNameSnapshot;

    @Column(name = "expected_result_snapshot", nullable = false)
    private String expectedResultSnapshot;

    @Column(name = "observed_result", nullable = false)
    private String observedResult;

    @Column(nullable = false)
    private String status;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;
}
