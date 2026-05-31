package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.dto.request.ImmunologyControlItemRequest;
import com.biodiagnostico.dto.request.ImmunologyControlSetRequest;
import com.biodiagnostico.dto.request.ImmunologyRunRequest;
import com.biodiagnostico.dto.request.ImmunologyRunResultRequest;
import com.biodiagnostico.dto.response.ImmunologyRunResponse;
import com.biodiagnostico.entity.ImmunologyControlItem;
import com.biodiagnostico.entity.ImmunologyControlSet;
import com.biodiagnostico.entity.ImmunologyQcRun;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.ImmunologyControlSetRepository;
import com.biodiagnostico.repository.ImmunologyQcRunRepository;
import com.biodiagnostico.repository.ReagentLotRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ImmunologyQcServiceTest {

    private ImmunologyQcService service;

    @Mock
    private ImmunologyControlSetRepository controlSetRepository;

    @Mock
    private ImmunologyQcRunRepository runRepository;

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @BeforeEach
    void setUp() {
        service = new ImmunologyQcService(controlSetRepository, runRepository, reagentLotRepository);
    }

    @Test
    @DisplayName("deve cadastrar controle qualitativo com resultados normalizados")
    void shouldCreateControlSetWithNormalizedResults() {
        ImmunologyControlSetRequest request = new ImmunologyControlSetRequest(
            "hiv",
            "Wama",
            "1022",
            LocalDate.of(2027, 10, 1),
            List.of(
                new ImmunologyControlItemRequest("Controle 1", "reagente"),
                new ImmunologyControlItemRequest("Controle 2", "não reagente")
            )
        );

        when(controlSetRepository.findByAnalitoIgnoreCaseAndIsActiveTrueOrderByCreatedAtDesc("HIV"))
            .thenReturn(List.of());
        when(controlSetRepository.save(any(ImmunologyControlSet.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createControlSet(request);

        assertThat(response.analito()).isEqualTo("HIV");
        assertThat(response.manufacturer()).isEqualTo("Wama");
        assertThat(response.controls()).extracting("expectedResult")
            .containsExactly("REAGENTE", "NAO_REAGENTE");
        verify(controlSetRepository).save(any(ImmunologyControlSet.class));
    }

    @Test
    @DisplayName("deve aprovar análise quando todos observados batem com esperado")
    void shouldApproveRunWhenAllObservedResultsMatchExpected() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HIV", "em_estoque", "Imunologia", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));
        when(runRepository.save(any(ImmunologyQcRun.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ImmunologyRunResponse response = service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(
                new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE"),
                new ImmunologyRunResultRequest(controlSet.getControls().get(1).getId(), "NAO_REAGENTE")
            ),
            "Ana",
            "Rotina nominal"
        ));

        assertThat(response.status()).isEqualTo("APROVADO");
        assertThat(response.analito()).isEqualTo("HIV");
        assertThat(response.reagentLotId()).isEqualTo(reagentLot.getId());
        assertThat(response.reagentLabel()).isEqualTo("HIV");
        assertThat(response.reagentLotNumber()).isEqualTo("R-1022");
        assertThat(response.results()).extracting("status").containsExactly("APROVADO", "APROVADO");
    }

    @Test
    @DisplayName("deve reprovar análise quando qualquer observado diverge do esperado")
    void shouldRejectRunWhenObservedResultDiffersFromExpected() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HIV", "em_estoque", "Imunologia", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));
        when(runRepository.save(any(ImmunologyQcRun.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ImmunologyRunResponse response = service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(
                new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "NAO_REAGENTE"),
                new ImmunologyRunResultRequest(controlSet.getControls().get(1).getId(), "NAO_REAGENTE")
            ),
            null,
            null
        ));

        assertThat(response.status()).isEqualTo("REPROVADO");
        assertThat(response.results()).extracting("status").containsExactly("REPROVADO", "APROVADO");
    }

    @Test
    @DisplayName("deve bloquear análise com controle vencido na data informada")
    void shouldRejectRunWithExpiredControlSetAtMeasurementDate() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2026, 5, 1));
        ReagentLot reagentLot = reagentLot("HIV", "em_estoque", "Imunologia", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));

        assertThatThrownBy(() -> service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(
                new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE"),
                new ImmunologyRunResultRequest(controlSet.getControls().get(1).getId(), "NAO_REAGENTE")
            ),
            null,
            null
        )))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("vencido");
    }

    @Test
    @DisplayName("deve bloquear análise com resultado faltante")
    void shouldRejectRunWithMissingControlResult() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HIV", "em_estoque", "Imunologia", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));

        assertThatThrownBy(() -> service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE")),
            null,
            null
        )))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("todos os controles");
    }

    @Test
    @DisplayName("deve aprovar análise com apenas um controle cadastrado")
    void shouldApproveRunWithSingleControl() {
        ImmunologyControlSet controlSet = singleControlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HIV", "em_estoque", "Imunologia", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));
        when(runRepository.save(any(ImmunologyQcRun.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ImmunologyRunResponse response = service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE")),
            null,
            null
        ));

        assertThat(response.status()).isEqualTo("APROVADO");
        assertThat(response.results()).hasSize(1);
        assertThat(response.results()).extracting("status").containsExactly("APROVADO");
    }

    @Test
    @DisplayName("deve bloquear análise com reagente vencido na data informada")
    void shouldRejectRunWithExpiredReagentLotAtMeasurementDate() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HIV", "em_estoque", "Imunologia", LocalDate.of(2026, 5, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));

        assertThatThrownBy(() -> service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(
                new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE"),
                new ImmunologyRunResultRequest(controlSet.getControls().get(1).getId(), "NAO_REAGENTE")
            ),
            null,
            null
        )))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Reagente vencido");
    }

    @Test
    @DisplayName("deve bloquear análise com reagente inativo")
    void shouldRejectRunWithInactiveReagentLot() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HIV", "inativo", "Imunologia", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));

        assertThatThrownBy(() -> service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(
                new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE"),
                new ImmunologyRunResultRequest(controlSet.getControls().get(1).getId(), "NAO_REAGENTE")
            ),
            null,
            null
        )))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("inativo ou vencido");
    }

    @Test
    @DisplayName("deve bloquear análise com reagente de outra categoria")
    void shouldRejectRunWithWrongReagentCategory() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HIV", "em_estoque", "Bioquímica", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));

        assertThatThrownBy(() -> service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(
                new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE"),
                new ImmunologyRunResultRequest(controlSet.getControls().get(1).getId(), "NAO_REAGENTE")
            ),
            null,
            null
        )))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("categoria Imunologia");
    }

    @Test
    @DisplayName("deve bloquear análise com soro-controle de outro analito")
    void shouldRejectRunWithDifferentControlAnalyte() {
        ImmunologyControlSet controlSet = controlSet(LocalDate.of(2027, 10, 1));
        ReagentLot reagentLot = reagentLot("HBsAg", "em_estoque", "Imunologia", LocalDate.of(2027, 10, 1));
        when(reagentLotRepository.findById(reagentLot.getId())).thenReturn(Optional.of(reagentLot));
        when(controlSetRepository.findById(controlSet.getId())).thenReturn(Optional.of(controlSet));

        assertThatThrownBy(() -> service.createRun(new ImmunologyRunRequest(
            LocalDate.of(2026, 5, 29),
            reagentLot.getId(),
            controlSet.getId(),
            List.of(
                new ImmunologyRunResultRequest(controlSet.getControls().get(0).getId(), "REAGENTE"),
                new ImmunologyRunResultRequest(controlSet.getControls().get(1).getId(), "NAO_REAGENTE")
            ),
            null,
            null
        )))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("não pertence ao analito");
    }

    @Test
    @DisplayName("deve excluir análise qualitativa existente")
    void shouldDeleteRun() {
        UUID id = UUID.randomUUID();
        ImmunologyQcRun run = ImmunologyQcRun.builder().id(id).build();
        when(runRepository.findById(id)).thenReturn(Optional.of(run));

        service.deleteRun(id);

        verify(runRepository).delete(run);
    }

    private ImmunologyControlSet controlSet(LocalDate validUntil) {
        ImmunologyControlSet controlSet = ImmunologyControlSet.builder()
            .id(UUID.randomUUID())
            .analito("HIV")
            .manufacturer("Wama")
            .lotNumber("1022")
            .validUntil(validUntil)
            .isActive(Boolean.TRUE)
            .build();
        ImmunologyControlItem positive = item(controlSet, "Controle 1", "REAGENTE", 1);
        ImmunologyControlItem negative = item(controlSet, "Controle 2", "NAO_REAGENTE", 2);
        controlSet.getControls().add(positive);
        controlSet.getControls().add(negative);
        return controlSet;
    }

    private ImmunologyControlSet singleControlSet(LocalDate validUntil) {
        ImmunologyControlSet controlSet = ImmunologyControlSet.builder()
            .id(UUID.randomUUID())
            .analito("HIV")
            .manufacturer("Wama")
            .lotNumber("1022")
            .validUntil(validUntil)
            .isActive(Boolean.TRUE)
            .build();
        controlSet.getControls().add(item(controlSet, "Controle 1", "REAGENTE", 1));
        return controlSet;
    }

    private ImmunologyControlItem item(ImmunologyControlSet controlSet, String name, String expected, int order) {
        return ImmunologyControlItem.builder()
            .id(UUID.randomUUID())
            .controlSet(controlSet)
            .name(name)
            .expectedResult(expected)
            .displayOrder(order)
            .build();
    }

    private ReagentLot reagentLot(String label, String status, String category, LocalDate expiryDate) {
        return ReagentLot.builder()
            .id(UUID.randomUUID())
            .name(label)
            .manufacturer("Wama")
            .lotNumber("R-1022")
            .category(category)
            .expiryDate(expiryDate)
            .unitsInStock(1)
            .unitsInUse(0)
            .storageTemp("2-8°C")
            .location("Geladeira CQ")
            .status(status)
            .build();
    }
}
