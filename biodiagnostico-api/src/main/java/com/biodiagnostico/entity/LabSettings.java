package com.biodiagnostico.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "lab_settings")
public class LabSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Builder.Default
    @Column(name = "lab_name", nullable = false)
    private String labName = "";

    @Builder.Default
    @Column(name = "responsible_name", nullable = false)
    private String responsibleName = "";

    @Builder.Default
    @Column(name = "responsible_registration", nullable = false)
    private String responsibleRegistration = "";

    @Builder.Default
    @Column(nullable = false)
    private String address = "";

    @Builder.Default
    @Column(nullable = false)
    private String phone = "";

    @Builder.Default
    @Column(nullable = false)
    private String email = "";

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;
}
