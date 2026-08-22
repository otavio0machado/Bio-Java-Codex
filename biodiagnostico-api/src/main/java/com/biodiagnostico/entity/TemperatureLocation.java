package com.biodiagnostico.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
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
@Table(name = "temperature_locations")
public class TemperatureLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String area = "GERAL";

    @Column(name = "min_temp_target", nullable = false, precision = 5, scale = 2)
    private BigDecimal minTempTarget;

    @Column(name = "max_temp_target", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxTempTarget;

    @Column(name = "min_humidity_target", precision = 5, scale = 2)
    private BigDecimal minHumidityTarget;

    @Column(name = "max_humidity_target", precision = 5, scale = 2)
    private BigDecimal maxHumidityTarget;

    @Column(name = "thermometer_code", length = 100)
    private String thermometerCode;

    @Column(name = "calibration_cert_number", length = 100)
    private String calibrationCertNumber;

    @Column(name = "calibration_due_date")
    private LocalDate calibrationDueDate;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String frequency = "DIARIO_1X";

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
