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
     * Regra de derivacao (ver {@link ReagentService#deriveStatus}):
     *  - expiryDate &lt; hoje e estoque &gt; 0 → {@code vencido} (risco operacional, descartar)
     *  - expiryDate &lt; hoje e estoque &lt;= 0 → {@code inativo} (historico/arquivo)
     *  - {@code quarentena} preserva (estado manual de excecao)
     *
     * Query {@code findExpiredNeedingReclassification} ja filtra {@code inativo} e
     * {@code quarentena}, entao o loop so precisa checar se o status derivado difere
     * do atual — evita saves desnecessarios.
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
            // Delega a ReagentService para unificar regra + trilha de auditoria:
            // cada transicao efetiva e gravada em audit_log com trigger="scheduler"
            // (ANVISA RDC 302 / ISO 15189 — rastreabilidade da reclassificacao automatica).
            if (reagentService.applyDerivedStatusFromScheduler(lot, today)) {
                updated.add(lot);
            }
        }

        if (updated.isEmpty()) {
            log.debug("Scheduler: {} candidato(s) vencido(s), 0 mudancas.", candidates.size());
            return;
        }

        reagentLotRepository.saveAll(updated);
        log.info("Auto-vencimento: {} lote(s) reclassificado(s) (vencido/inativo) entre {} candidato(s).",
            updated.size(), candidates.size());
    }
}
