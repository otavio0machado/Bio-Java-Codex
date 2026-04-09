package com.biodiagnostico.scheduler;

import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.repository.ReagentLotRepository;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ReagentExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReagentExpiryScheduler.class);

    private final ReagentLotRepository reagentLotRepository;

    public ReagentExpiryScheduler(ReagentLotRepository reagentLotRepository) {
        this.reagentLotRepository = reagentLotRepository;
    }

    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void markExpiredLots() {
        LocalDate today = LocalDate.now();
        List<ReagentLot> expiredLots = reagentLotRepository.findExpiredNotMarked(today);

        if (expiredLots.isEmpty()) {
            log.debug("Nenhum lote expirado encontrado para atualizar.");
            return;
        }

        for (ReagentLot lot : expiredLots) {
            lot.setStatus("vencido");
        }
        reagentLotRepository.saveAll(expiredLots);
        log.info("Auto-vencimento: {} lote(s) atualizado(s) para status 'vencido'.", expiredLots.size());
    }
}
