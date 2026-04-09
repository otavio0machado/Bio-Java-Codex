package com.biodiagnostico.repository;

import com.biodiagnostico.entity.HematologyQcParameter;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HematologyQcParameterRepository extends JpaRepository<HematologyQcParameter, UUID> {

    List<HematologyQcParameter> findByIsActiveTrue();

    List<HematologyQcParameter> findByAnalitoAndIsActiveTrue(String analito);
}
