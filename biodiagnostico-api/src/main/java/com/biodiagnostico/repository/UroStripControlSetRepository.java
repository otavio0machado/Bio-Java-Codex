package com.biodiagnostico.repository;

import com.biodiagnostico.entity.UroStripControlSet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UroStripControlSetRepository extends JpaRepository<UroStripControlSet, UUID> {

    List<UroStripControlSet> findByIsActiveTrueOrderByCreatedAtDesc();

    List<UroStripControlSet> findAllByOrderByIsActiveDescCreatedAtDesc();
}
