# Teste E2E do MVP

O fluxo `mvp.yaml` valida o caminho crítico em um build próprio do aplicativo:

1. abre o app com estado limpo;
2. autentica um usuário de testes no Keycloak;
3. acessa a lista de ocorrências;
4. confirma a validação dos campos obrigatórios;
5. preenche o formulário e obtém a localização pelo GPS;
6. cria a ocorrência pelo backend;
7. confirma que ela aparece na listagem;
8. sai da sessão e reabre o app sem limpar dados, confirmando o retorno ao login (TC-03).

## Pré-requisitos

- APK de desenvolvimento ou preview instalado com o application ID
  `com.darkartsbm.smartcitys`;
- Metro em execução quando for usado um development build;
- emulador ou aparelho visível em `adb devices`;
- Maestro CLI disponível no `PATH`;
- Keycloak, API e banco do ambiente de testes acessíveis pelo aparelho;
- usuário Keycloak dedicado aos testes.

Não coloque usuário nem senha no Git. Passe-os como variáveis na execução:

```powershell
maestro test `
  -e E2E_USERNAME=usuario-de-teste `
  -e E2E_PASSWORD=senha-de-teste `
  -e E2E_TITLE="Ocorrencia E2E 001" `
  .maestro/mvp.yaml
```

O mesmo fluxo pode ser iniciado pelo workspace mobile:

```powershell
npm run mobile:test:e2e -- `
  -e E2E_USERNAME=usuario-de-teste `
  -e E2E_PASSWORD=senha-de-teste `
  -e E2E_TITLE="Ocorrencia E2E 001"
```

Use um título diferente a cada execução caso o backend não limpe os dados de
teste. O fluxo é intencionalmente externo aos testes Jest: ele usa integrações
reais e, portanto, cria um registro real no ambiente apontado por `.env.local`.

## GitHub Actions

O workflow `.github/workflows/testes-api.yml` permite execução manual pelo menu
Actions → Regressão completa → Run workflow. Ele executa todos os testes Jest
(unitários e componentes), todos os testes de API habilitados e todo o fluxo MVP
Maestro, incluindo logout. Os filtros avançados com `it.skip` permanecem fora
do escopo definido em `documents/testes-ia.md`; aparecem como ignorados.

Configure os repository secrets `E2E_USERNAME`, `E2E_PASSWORD` e
`GOOGLE_MAPS_ANDROID_API_KEY`. O realm usado é `smartcitys-test`, em
`https://auth.darkartsbm.com`, com cliente público `smartcitys-mobile-test`,
PKCE S256, callback `wb://auth/callback` e audience `smartcitys-api-test`.
O usuário deve ter papel de realm `cidadao`, senha não temporária e nenhuma
ação obrigatória que interrompa o login.

PostgreSQL, Redis e os três serviços Node são temporários no runner. O APK é
gerado com bundle JavaScript para x86_64 e instalado no emulador Android API 34.
A API usa `http://localhost:8080` com redirecionamento ADB; somente o APK gerado
na CI recebe a permissão de HTTP para localhost. O Keycloak permanece em HTTPS.
O APK usa a assinatura de testes do template Expo; não é um build de distribuição.
Se a chave Google Maps tiver restrição de assinatura, confira se permite esse
certificado de teste. Não é necessário publicar a API de testes na internet.

Os steps de testes usam `continue-on-error` para permitir que os próximos níveis
sejam executados. O step final verifica os resultados originais (`outcome`) e
falha se qualquer nível falhar ou não executar. Os resultados do Maestro são
salvos no artefato `evidencias-e2e-<run_id>`, inclusive quando o E2E falha.

O banco é descartado ao terminar o job; o usuário e as sessões no realm de
testes continuam no Keycloak. Uma execução completa no GitHub ainda é necessária
para validar o build, as credenciais e os seletores do login nesse ambiente.
