package com.biodiagnostico.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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
import org.hibernate.annotations.UpdateTimestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "reagent_lots")
public class ReagentLot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "lot_number", nullable = false)
    private String lotNumber;

    private String manufacturer;

    private String category;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Builder.Default
    @Column(name = "quantity_value")
    private Double quantityValue = 0D;

    @Builder.Default
    @Column(name = "stock_unit")
    private String stockUnit = "unidades";

    @Builder.Default
    @Column(name = "current_stock")
    private Double currentStock = 0D;

    @Builder.Default
    @Column(name = "estimated_consumption")
    private Double estimatedConsumption = 0D;

    @Column(name = "storage_temp")
    private String storageTemp;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Builder.Default
    @Column(nullable = false)
    private String status = "ativo";

    // ===== Fase 3: rastreabilidade forte =====

    /** Localizacao fisica do lote (ex: "Geladeira 2, Prateleira B"). */
    @Column(length = 128)
    private String location;

    /** Fornecedor que entregou o lote (pode diferir do fabricante). */
    @Column(length = 128)
    private String supplier;

    /** Data em que o lote foi recebido no laboratorio. */
    @Column(name = "received_date")
    private LocalDate receivedDate;

    /** Data em que o lote foi aberto para uso (diferente de startDate). */
    @Column(name = "opened_date")
    private LocalDate openedDate;

    @Builder.Default
    @Column(name = "alert_threshold_days")
    private Integer alertThresholdDays = 7;

    @Builder.Default
    @OneToMany(mappedBy = "reagentLot", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private List<StockMovement> movements = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
