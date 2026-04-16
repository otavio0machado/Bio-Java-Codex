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
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reagent_lot_id", nullable = false)
    @JsonIgnore
    private ReagentLot reagentLot;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private Double quantity;

    private String responsible;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "previous_stock")
    private Double previousStock;

    /**
     * Motivo do movimento. Obrigatorio em AJUSTE e em SAIDA que zere o estoque;
     * opcional em ENTRADA. Valida contra {@link MovementReason}.
     */
    @Column(length = 32)
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
