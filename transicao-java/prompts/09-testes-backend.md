# Prompt 09 — Testes do Backend

Cole este prompt inteiro no Claude:

---

Crie testes automatizados para o Biodiagnóstico 4.0 (Spring Boot 3). Use JUnit 5 + Mockito para testes unitários e MockMvc para testes de API.

## Testes Unitários necessários:

### 1. WestgardEngineTest.java
Testar TODAS as 6 regras do Westgard:

```java
@ExtendWith(MockitoExtension.class)
class WestgardEngineTest {
    @InjectMocks WestgardEngine engine;

    // Testes:
    // - shouldReturnEmptyWhenValueWithinNormalRange (z < 2)
    // - shouldDetect1_2sWarning (z > 2, z < 3)
    // - shouldDetect1_3sRejection (z > 3)
    // - shouldDetect2_2sWhenTwoConsecutiveAbove2SD
    // - shouldDetect2_2sWhenTwoConsecutiveBelow2SD
    // - shouldNotDetect2_2sWhenOnDifferentSides
    // - shouldDetectR4sWhenDifferenceExceeds4SD
    // - shouldDetect4_1sWhenFourConsecutiveAbove1SD
    // - shouldDetect10xWhenTenConsecutiveSameSide
    // - shouldReturnSD0WarningWhenStandardDeviationIsZero
    // - shouldHandleEmptyHistory
    // - shouldHandleNullHistory
}
```

Para cada teste, criar QcRecord com builder especificando value, targetValue, targetSd. Criar history list com registros anteriores.

### 2. QcServiceTest.java
Testar a lógica de negócio principal:

```java
@ExtendWith(MockitoExtension.class)
class QcServiceTest {
    @InjectMocks QcService qcService;
    @Mock QcRecordRepository recordRepository;
    @Mock QcReferenceValueRepository referenceRepository;
    @Mock WestgardEngine westgardEngine;
    @Mock QcExamRepository examRepository;

    // Testes:
    // - shouldCreateRecordWithApprovedStatus
    // - shouldCreateRecordWithRejectedStatusWhenWestgardFails
    // - shouldSetNeedsCalibrationWhenCvExceedsLimit
    // - shouldCalculateCvCorrectly
    // - shouldCalculateZScoreCorrectly
    // - shouldReturnRecordsFilteredByArea
    // - shouldThrowNotFoundWhenRecordDoesNotExist
}
```

### 3. ReagentServiceTest.java
```java
// Testes:
// - shouldCreateLotSuccessfully
// - shouldUpdateCurrentStockOnEntradaMovement
// - shouldDecreaseCurrentStockOnSaidaMovement
// - shouldSetStockOnAjusteMovement
// - shouldCalculateDaysLeftCorrectly
// - shouldFindExpiringLots
```

### 4. AuthServiceTest.java
```java
// Testes:
// - shouldLoginWithValidCredentials
// - shouldThrowOnInvalidPassword
// - shouldThrowOnNonExistentEmail
// - shouldThrowOnInactiveUser
// - shouldRefreshTokenSuccessfully
// - shouldThrowOnExpiredRefreshToken
// - shouldRegisterNewUser
// - shouldThrowOnDuplicateEmail
```

## Testes de API (MockMvc):

### 5. QcRecordControllerTest.java
```java
@WebMvcTest(QcRecordController.class)
class QcRecordControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean QcService qcService;
    @MockBean JwtTokenProvider jwtTokenProvider; // para SecurityConfig

    // Testes:
    // - shouldReturn200WhenGettingRecords
    // - shouldReturn201WhenCreatingRecord
    // - shouldReturn400WhenRequestIsInvalid (Bean Validation)
    // - shouldReturn404WhenRecordNotFound
    // - shouldReturn401WhenNotAuthenticated
}
```

### 6. AuthControllerTest.java
```java
@WebMvcTest(AuthController.class)
class AuthControllerTest {
    // Testes:
    // - shouldReturn200OnSuccessfulLogin
    // - shouldReturn400OnInvalidLoginRequest
    // - shouldReturn200OnTokenRefresh
    // - shouldReturn201OnRegister (com token de ADMIN)
    // - shouldReturn403OnRegisterWithoutAdminRole
}
```

## Regras:
- Use `@DisplayName` em português para legibilidade
- Use AssertJ para assertions (`assertThat(...)`)
- Cada teste deve ser independente e idempotente
- Use `@BeforeEach` para setup comum
- Para MockMvc, use `.with(SecurityMockMvcRequestPostProcessors.jwt())` para simular autenticação
- Gere TODOS os testes completos, sem placeholders
