package com.biodiagnostico.repository;

import com.biodiagnostico.entity.StockMovement;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    List<StockMovement> findByReagentLotIdOrderByCreatedAtDesc(UUID lotId);
}
