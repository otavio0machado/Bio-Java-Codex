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

    /**
     * Coluna {@code name} no banco; semanticamente representa a etiqueta agrupadora
     * exposta no contrato externo como {@code label} (refator-reagentes-v2). A coluna
     * permanece com o nome historico para preservar audit_log e indices.
     */
    @Column(nullable = false)
    private String name;

    @Column(name = "lot_number", nullable = false)
    private String lotNumber;

    /** Promovido a NOT NULL pela migracao V13. */
    @Column(nullable = false)
    private String manufacturer;

    private String category;

    /** Promovido a NOT NULL pela migracao V13. */
    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Builder.Default
    @Column(name = "current_stock")
    private Double currentStock = 0D;

    @Column(name = "storage_temp")
    private String storageTemp;

    @Builder.Default
    @Column(nullable = false)
    private String status = ReagentStatus.EM_ESTOQUE;

    // ===== Rastreabilidade forte (RDC 302 / ISO 15189) =====

    /** Localizacao fisica do lote (ex: "Geladeira 2, Prateleira B"). */
    @Column(length = 128)
    private String location;

    /** Fornecedor que entregou o lote (pode diferir do fabricante). */
    @Column(length = 128)
    private String supplier;

    /** Data em que o lote foi recebido no laboratorio. */
    @Column(name = "received_date")
    private LocalDate receivedDate;

    /**
     * Data em que o lote foi aberto para uso.
     *
     * <p>Setada automaticamente quando o status final do lote for {@code em_uso} e o
     * campo estiver nulo (ver {@code ReagentService#applyOpenedDateOnUseTransition}).</p>
     */
    @Column(name = "opened_date")
    private LocalDate openedDate;

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
