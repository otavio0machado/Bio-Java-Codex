package com.biodiagnostico.repository;

import com.biodiagnostico.entity.ImmunologyControlSet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImmunologyControlSetRepository extends JpaRepository<ImmunologyControlSet, UUID> {

    List<ImmunologyControlSet> findByIsActiveTrueOrderByAnalitoAscManufacturerAscLotNumberAsc();

    List<ImmunologyControlSet> findByAnalitoIgnoreCaseAndIsActiveTrueOrderByCreatedAtDesc(String analito);
}
