package com.biodiagnostico.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
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
@Table(name = "temperature_records")
public class TemperatureRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    private TemperatureLocation location;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime time;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String period = "UNICO";

    @Column(name = "temp_current", precision = 5, scale = 2)
    private BigDecimal tempCurrent;

    @Column(name = "temp_max", nullable = false, precision = 5, scale = 2)
    private BigDecimal tempMax;

    @Column(name = "temp_min", nullable = false, precision = 5, scale = 2)
    private BigDecimal tempMin;

    @Column(name = "temp_max_in", precision = 5, scale = 2)
    private BigDecimal tempMaxIn;

    @Column(name = "temp_min_in", precision = 5, scale = 2)
    private BigDecimal tempMinIn;

    @Column(precision = 5, scale = 2)
    private BigDecimal humidity;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "CONFORME";

    @Column(nullable = false, length = 100)
    private String responsible;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_id")
    private User responsibleUser;

    @Column(name = "action_taken", columnDefinition = "TEXT")
    private String actionTaken;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Column(name = "photo_filename", length = 255)
    private String photoFilename;

    @Column(name = "photo_min_url", columnDefinition = "TEXT")
    private String photoMinUrl;

    @Column(name = "photo_min_filename", length = 255)
    private String photoMinFilename;

    @Column(name = "ocr_raw_result", columnDefinition = "TEXT")
    private String ocrRawResult;

    @Column(name = "ocr_applied", nullable = false)
    @Builder.Default
    private Boolean ocrApplied = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
