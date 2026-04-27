package com.biodiagnostico.scheduler;

import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.service.ReagentService;
import java.time.LocalDate;
import java.util.ArrayList;
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
    private final ReagentService reagentService;

    public ReagentExpiryScheduler(
        ReagentLotRepository reagentLotRepository,
        ReagentService reagentService
    ) {
        this.reagentLotRepository = reagentLotRepository;
        this.reagentService = reagentService;
    }

    /**
     * Reclassifica diariamente os lotes vencidos.
     *
     * Regra de derivacao (refator-v2 — ver {@link ReagentService#deriveStatus}):
     *  - expiryDate &lt; hoje (qualquer estoque) → {@code vencido} (terminal de validade)
     *  - estoque = 0 e expiry futura → {@code fora_de_estoque}
     *  - openedDate setado e expiry futura → {@code em_uso}
     *  - caso contrario → {@code em_estoque}
     *
     * <p>Apos refator-v2, {@code vencido} e o unico estado terminal de validade. A query
     * {@code findExpiredNeedingReclassification} filtra {@code vencido} para evitar
     * saves desnecessarios; o loop chama {@link ReagentService#applyDerivedStatusFromScheduler}
     * que emite audit_log com {@code trigger="scheduler"} a cada transicao efetiva.</p>
     */
    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void markExpiredLots() {
        LocalDate today = LocalDate.now();
        List<ReagentLot> candidates = reagentLotRepository.findExpiredNeedingReclassification(today);

        if (candidates.isEmpty()) {
            log.debug("Nenhum lote expirado encontrado para reclassificar.");
            return;
        }

        List<ReagentLot> updated = new ArrayList<>();
        for (ReagentLot lot : candidates) {
            if (reagentService.applyDerivedStatusFromScheduler(lot, today)) {
                updated.add(lot);
            }
        }

        if (updated.isEmpty()) {
            log.debug("Scheduler: {} candidato(s) vencido(s), 0 mudancas.", candidates.size());
            return;
        }

        reagentLotRepository.saveAll(updated);
        log.info("Auto-vencimento: {} lote(s) reclassificado(s) para 'vencido' entre {} candidato(s).",
            updated.size(), candidates.size());
    }
}
