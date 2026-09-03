package com.biodiagnostico.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "uro_strip_control_sets")
public class UroStripControlSet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "control_lot_number", nullable = false)
    private String controlLotNumber;

    @Column(nullable = false)
    private String manufacturer;

    @Column(name = "valid_until", nullable = false)
    private LocalDate validUntil;

    @Column(name = "expected_ph_min")
    private Double expectedPhMin;

    @Column(name = "expected_ph_max")
    private Double expectedPhMax;

    @Column(name = "expected_density_min")
    private Double expectedDensityMin;

    @Column(name = "expected_density_max")
    private Double expectedDensityMax;

    @Builder.Default
    @Column(name = "expected_proteins", nullable = false)
    private String expectedProteins = "NEGATIVO";

    @Builder.Default
    @Column(name = "expected_glucose", nullable = false)
    private String expectedGlucose = "NEGATIVO";

    @Builder.Default
    @Column(name = "expected_ketones", nullable = false)
    private String expectedKetones = "NEGATIVO";

    @Builder.Default
    @Column(name = "expected_blood", nullable = false)
    private String expectedBlood = "NEGATIVO";

    @Builder.Default
    @Column(name = "expected_urobilinogen", nullable = false)
    private String expectedUrobilinogen = "NORMAL";

    @Builder.Default
    @Column(name = "expected_nitrite", nullable = false)
    private String expectedNitrite = "NEGATIVO";

    @Builder.Default
    @Column(name = "expected_bilirubin", nullable = false)
    private String expectedBilirubin = "NEGATIVO";

    @Builder.Default
    @Column(name = "expected_leukocytes", nullable = false)
    private String expectedLeukocytes = "NEGATIVO";

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = Boolean.TRUE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
