package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.biodiagnostico.dto.request.UroSedimentRunRequest;
import com.biodiagnostico.dto.request.UroStripControlSetRequest;
import com.biodiagnostico.dto.request.UroStripRunRequest;
import com.biodiagnostico.dto.response.UroSedimentRunResponse;
import com.biodiagnostico.dto.response.UroStripRunResponse;
import com.biodiagnostico.entity.ReagentLot;
import com.biodiagnostico.entity.UroSedimentQcRun;
import com.biodiagnostico.entity.UroStripControlSet;
import com.biodiagnostico.entity.UroStripQcRun;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.ReagentLotRepository;
import com.biodiagnostico.repository.UroSedimentQcRunRepository;
import com.biodiagnostico.repository.UroStripControlSetRepository;
import com.biodiagnostico.repository.UroStripQcRunRepository;
import com.biodiagnostico.repository.UserRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UroanaliseQcServiceTest {

    private UroanaliseQcService service;

    @Mock
    private UroStripControlSetRepository controlSetRepository;

    @Mock
    private UroStripQcRunRepository stripRunRepository;

    @Mock
    private UroSedimentQcRunRepository sedimentRunRepository;

    @Mock
    private ReagentLotRepository reagentLotRepository;

    @Mock
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        service = new UroanaliseQcService(
            controlSetRepository,
            stripRunRepository,
            sedimentRunRepository,
            reagentLotRepository,
            userRepository
        );
    }

    @Test
    @DisplayName("deve calcular o coeficiente de variacao (CV) corretamente e lidar com contagens zeradas")
    void shouldCalculateCvCorrectly() {
        // Analista 1 = 4, Analista 2 = 3 -> Média = 3.5, DP = 0.7071 -> CV = 20.20% (Reprovado > 20%)
        double cv43 = UroanaliseQcService.calculateCv(4.0, 3.0);
        assertThat(cv43).isEqualTo(20.20);

        // Analista 1 = 2, Analista 2 = 2 -> CV = 0.0% (Aprovado <= 20%)
        double cv22 = UroanaliseQcService.calculateCv(2.0, 2.0);
        assertThat(cv22).isEqualTo(0.0);

        // Analista 1 = 0, Analista 2 = 0 -> CV = 0.0% (Aprovado sem divisao por zero)
        double cv00 = UroanaliseQcService.calculateCv(0.0, 0.0);
        assertThat(cv00).isEqualTo(0.0);
    }

    @Test
    @DisplayName("deve aprovar corrida de fita quando todos os analitos baterem com o controle esperado")
    void shouldCreateStripRunApprovedWhenAllAnalytesMatch() {
        UUID controlId = UUID.randomUUID();
        UroStripControlSet controlSet = UroStripControlSet.builder()
            .id(controlId)
            .controlLotNumber("URiE 02382024")
            .manufacturer("Uro-Trol")
            .validUntil(LocalDate.of(2026, 4, 23))
            .expectedPhMin(5.0)
            .expectedPhMax(6.0)
            .expectedDensityMin(1.005)
            .expectedDensityMax(1.025)
            .expectedProteins("NEGATIVO")
            .expectedGlucose("NEGATIVO")
            .expectedKetones("NEGATIVO")
            .expectedBlood("NEGATIVO")
            .expectedUrobilinogen("NORMAL")
            .expectedNitrite("NEGATIVO")
            .isActive(true)
            .build();

        when(controlSetRepository.findById(controlId)).thenReturn(Optional.of(controlSet));
        when(stripRunRepository.save(any(UroStripQcRun.class))).thenAnswer(invocation -> {
            UroStripQcRun run = invocation.getArgument(0);
            run.setId(UUID.randomUUID());
            return run;
        });

        UroStripRunRequest request = new UroStripRunRequest(
            controlId,
            LocalDate.of(2026, 9, 3),
            null,
            5.5,
            1.010,
            "0", // sinônimo de negativo
            "NEGATIVO",
            "0",
            "0",
            "NORMAL",
            "NEGATIVO",
            null,
            "Analista Teste",
            "Tira Urofita lote 67551"
        );

        UroStripRunResponse response = service.createStripRun(request, "admin");

        assertThat(response.statusGeral()).isEqualTo("APROVADO");
        assertThat(response.statusPh()).isEqualTo("APROVADO");
        assertThat(response.statusDensity()).isEqualTo("APROVADO");
        assertThat(response.statusProteins()).isEqualTo("APROVADO");
        assertThat(response.statusGlucose()).isEqualTo("APROVADO");
        verify(stripRunRepository).save(any(UroStripQcRun.class));
    }

    @Test
    @DisplayName("deve exigir acao corretiva quando a corrida de fita tiver parametros reprovados")
    void shouldRequireCorrectiveActionWhenStripRunFails() {
        UUID controlId = UUID.randomUUID();
        UroStripControlSet controlSet = UroStripControlSet.builder()
            .id(controlId)
            .controlLotNumber("URiE 02382024")
            .manufacturer("Uro-Trol")
            .validUntil(LocalDate.of(2026, 4, 23))
            .expectedPhMin(5.0)
            .expectedPhMax(6.0)
            .expectedDensityMin(1.005)
            .expectedDensityMax(1.025)
            .expectedProteins("NEGATIVO")
            .expectedGlucose("NEGATIVO")
            .expectedKetones("NEGATIVO")
            .expectedBlood("NEGATIVO")
            .expectedUrobilinogen("NORMAL")
            .expectedNitrite("NEGATIVO")
            .isActive(true)
            .build();

        when(controlSetRepository.findById(controlId)).thenReturn(Optional.of(controlSet));

        // pH 6.5 excede 6.0 e Glicose POSITIVO diverge do esperado
        UroStripRunRequest requestSemAcao = new UroStripRunRequest(
            controlId,
            LocalDate.of(2026, 9, 3),
            null,
            6.5,
            1.025,
            "NEGATIVO",
            "POSITIVO",
            "NEGATIVO",
            "NEGATIVO",
            "NORMAL",
            "NEGATIVO",
            null, // sem acao corretiva
            "Analista Teste",
            null
        );

        assertThatThrownBy(() -> service.createStripRun(requestSemAcao, "admin"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Ação corretiva é obrigatória");
    }

    @Test
    @DisplayName("deve salvar corrida de sedimento aprovada quando CV <= 20% e elementos coincidirem")
    void shouldCreateSedimentRunApproved() {
        when(sedimentRunRepository.save(any(UroSedimentQcRun.class))).thenAnswer(invocation -> {
            UroSedimentQcRun run = invocation.getArgument(0);
            run.setId(UUID.randomUUID());
            return run;
        });

        UroSedimentRunRequest request = new UroSedimentRunRequest(
            LocalDate.of(2026, 9, 3),
            "11111111",
            null,
            "Biomédica 1",
            null,
            "Biomédica 2",
            2.0,
            2.0, // CV = 0%
            2.0,
            2.0, // CV = 0%
            "Discreta",
            "Discreta",
            "Ausente",
            "Ausente",
            "Presente",
            "Presente",
            "Ausente",
            "Ausente",
            "Ausente",
            "Ausente",
            null,
            null
        );

        UroSedimentRunResponse response = service.createSedimentRun(request);

        assertThat(response.statusGeral()).isEqualTo("APROVADO");
        assertThat(response.statusLeukocytes()).isEqualTo("APROVADO");
        assertThat(response.leukocytesCv()).isEqualTo(0.0);
        assertThat(response.statusBacteria()).isEqualTo("APROVADO");
        verify(sedimentRunRepository).save(any(UroSedimentQcRun.class));
    }

    @Test
    @DisplayName("deve reprovar sedimento e exigir acao corretiva quando leucocitos estourarem CV (ex: 4 vs 3 da Foto 2)")
    void shouldFailSedimentRunWithoutActionWhenLeukocytesExceedCv() {
        UroSedimentRunRequest request = new UroSedimentRunRequest(
            LocalDate.of(2026, 9, 3),
            "11111111",
            null,
            "Analista 1",
            null,
            "Analista 2",
            4.0,
            3.0, // CV = 20.20% > 20%
            2.0,
            2.0,
            "Discreta",
            "Discreta",
            "Ausente",
            "Ausente",
            "Presente",
            "Presente",
            "Ausente",
            "Ausente",
            "Ausente",
            "Ausente",
            null, // sem acao
            null
        );

        assertThatThrownBy(() -> service.createSedimentRun(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Ação corretiva é obrigatória");
    }

    @Test
    @DisplayName("deve permitir salvar sedimento reprovado quando fornecida a acao corretiva obrigatoria")
    void shouldAllowFailedSedimentWithCorrectiveAction() {
        when(sedimentRunRepository.save(any(UroSedimentQcRun.class))).thenAnswer(invocation -> {
            UroSedimentQcRun run = invocation.getArgument(0);
            run.setId(UUID.randomUUID());
            return run;
        });

        UroSedimentRunRequest request = new UroSedimentRunRequest(
            LocalDate.of(2026, 9, 3),
            "11111111",
            null,
            "Analista 1",
            null,
            "Analista 2",
            4.0,
            3.0, // CV = 20.20% -> REPROVADO
            2.0,
            2.0,
            "Discreta",
            "Moderada", // Divergente -> REPROVADO
            "Ausente",
            "Ausente",
            "Presente",
            "Presente",
            "Ausente",
            "Ausente",
            "Ausente",
            "Ausente",
            "Revisão conjunta das lâminas no microscópio para padronização de campos",
            "Amostra de rotina 11111111"
        );

        UroSedimentRunResponse response = service.createSedimentRun(request);

        assertThat(response.statusGeral()).isEqualTo("REPROVADO");
        assertThat(response.statusLeukocytes()).isEqualTo("REPROVADO");
        assertThat(response.statusBacteria()).isEqualTo("REPROVADO");
        assertThat(response.correctiveAction()).isEqualTo("Revisão conjunta das lâminas no microscópio para padronização de campos");
        verify(sedimentRunRepository).save(any(UroSedimentQcRun.class));
    }
}
