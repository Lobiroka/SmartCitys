# Preparar a distribuição Android

O perfil `preview` do EAS Build gera um APK assinado para distribuição interna. O mesmo APK recebe atualizações compatíveis do canal `preview`.

## APK final 1.0.2 — 24/11/2026

[Baixar APK](https://expo.dev/artifacts/eas/wzHDfBIjJpJ1IO0ue4f749Alez2Vzrt7YCiAjulM_Iw.apk) · [Build concluído](https://expo.dev/accounts/dkartss-team/projects/wb/builds/f0bce9b6-f868-44c0-8b1a-db11d847c50b) · [Relatório e evidências](../../docs/tas-evidence/final-apk-1.0.2-2026-11-24/README.md).

Compilado do commit `18dfe1c`, integrado pela PR #45. Nome nativo **SmartCitys**,
versão **1.0.2**, versionCode **3** e runtime **1.0.2**, com a assinatura anterior
preservada e o JavaScript embutido. Instalação limpa e atualização sobre o preview
1.0.1 foram verificadas nos emuladores dedicados.

A jornada de cadastro/login → foto/GPS → filtros/acompanhamento → gestor pela tela
→ push/status ao cidadão passou nas três etapas, sem Metro e sem encaminhamentos
ADB para a API ou o bundle. O ensaio usa API HTTPS e Keycloak compartilhados, dois
Androids API 36 e câmera/GPS virtuais. Não comprova aceite em iPhone nem preservação
de sessões antigas: o roteiro limpa os dados dos dispositivos de testes.

SHA-256: `a2eacb1759627fc826a9499a489be3386fb67f5ab2b52b77711f5d6e1b7eb20b`.
O APK é o preview distribuível da entrega, sem exigir instalação do código ou Metro
na máquina do avaliador. Não houve publicação em loja nem deploy AWS nesta versão.

## Nome exibido do aplicativo

O nome público é **SmartCitys**, definido em `expo.name` no `app.json` e usado
pelo `app.config.ts`. A tela de login e os textos de permissão usam a mesma marca.
O Expo gera o nome do Android (`app_name`) e o nome exibido no iOS a partir dessa
configuração durante a compilação nativa.

O nome sob o ícone dos aplicativos já instalados só muda ao instalar um novo
APK/build; uma atualização OTA de JavaScript não substitui esse recurso nativo.
O APK final 1.0.2 foi gerado após atualizar a versão conforme a política de runtime.
A alteração de nome já está incluída nesse arquivo; instalar novamente um link
de build antigo continua fornecendo o APK antigo.

O `slug` e o `scheme` continuam `wb`; o projeto EAS e os identificadores Android
e iOS permanecem os mesmos. Eles identificam integrações e o retorno de login,
e não precisam acompanhar o nome público. Não é necessário recriar o projeto
Expo, Firebase, as contas Keycloak ou as restrições Maps por causa desse nome.

## Preview 1.0.1

A versão 1.0.1 incorpora no próprio APK as correções já presentes na `main`: menu do perfil somente com Sair, controles do mapa alinhados e afastados da barra do sistema, e sincronização das permissões de notificações pelas configurações do Android. Uma instalação nova não precisa buscar uma OTA anterior para receber essas correções.

O runtime acompanha a versão do app (`appVersion`), portanto passa a ser 1.0.1. OTAs do runtime 1.0.0 não são aplicadas a este APK. O EAS gerencia o `versionCode` remotamente e o incrementa a cada build preview; a assinatura e o identificador Android são mantidos para permitir atualizar uma instalação existente.

Para distribuir, compartilhar o link do build 1.0.1 concluído no Expo. O link de um build 1.0.0 continua servindo o APK antigo e não é atualizado por uma OTA. Validar a primeira abertura com instalação limpa e também a atualização sobre o preview anterior antes de considerar a distribuição homologada.

## Projeto Expo e Firebase

1. Na pasta `apps/mobile`, carregue a chave do Maps do ambiente local e use `npx eas-cli@latest login` e `npx eas-cli@latest project:init`. Se a CLI pedir para informar o ID manualmente por causa do app config dinâmico, salve-o em `EXPO_PUBLIC_EAS_PROJECT_ID` ou em `expo.extra.eas.projectId`.
2. No Firebase, crie ou abra o projeto do SmartCitys e cadastre o app Android com o pacote `com.darkartsbm.smartcitys`. Envie o arquivo Android `google-services.json` ao ambiente `preview` do EAS como variável de arquivo `GOOGLE_SERVICES_JSON`.
3. Use `npx eas-cli@latest credentials -p android` para cadastrar a credencial FCM v1 no projeto Expo. O arquivo de conta de serviço fica separado de `google-services.json` e fora do repositório.
4. No ambiente `preview` do EAS, configure `EXPO_PUBLIC_API_URL` com a URL HTTPS externa, `EXPO_PUBLIC_KEYCLOAK_ISSUER`, `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` e `GOOGLE_MAPS_ANDROID_API_KEY`. A chave de mapa precisa aceitar o pacote e o SHA-1 do APK assinado. Use visibilidade que permita ao EAS CLI resolver o app config quando for executar OTA.

A variável local para resolver o app config pode ser carregada no PowerShell sem exibir o valor.

```powershell
$env:GOOGLE_MAPS_ANDROID_API_KEY = node --env-file=.env.local -p "process.env.GOOGLE_MAPS_ANDROID_API_KEY"
```

## API e notificações

Antes do APK, publique a API HTTPS e valide o fluxo do cidadão e do gestor. Na EC2, mantenha o gateway publicado apenas em `127.0.0.1:8080` e configure `TRUSTED_PROXY_ADDRESS` no container do gateway com o IP exato que ele vê para o Caddy. Na rede bridge padrão do Compose, confira o gateway da rede com `docker network inspect` e confirme o endereço observado antes de liberar as rotas. O proxy deve sobrescrever os cabeçalhos encaminhados vindos do cliente. Aplique a migration `20261109000000_add_push_devices` pelo Prisma e atualize o Demand Service. Habilite a segurança de push no painel Expo e injete `EXPO_PUSH_ACCESS_TOKEN` no container do Demand Service. Esse token fica apenas no servidor.

O Android pede a permissão de notificações depois do aviso de localização. O cidadão pode mudar essa escolha nas configurações do celular. Depois de ativá-las, mude o status de uma ocorrência dele com a conta gestora. Confira a entrega com o app em primeiro e segundo plano. O logout remove a inscrição desse aparelho quando a API está acessível.

## APK e OTA

Gere o APK depois de concluir a configuração de credenciais, a publicação da API e os testes anteriores que podem ser executados com o app de desenvolvimento. Rode os comandos abaixo em `apps/mobile`.

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest update --channel preview --environment preview --message "Atualização do piloto Android"
```

O segundo comando é usado depois que o primeiro APK compatível estiver instalado. Valide a OTA com uma mudança visual pequena no canal `preview`. A configuração usa `appVersion` como política de runtime. Quando houver mudança de código ou configuração nativa, aumente `expo.version` e gere outro APK. Mantenha a mesma versão para atualizações JavaScript e de assets compatíveis com o APK existente.

## Publicação automática pela main

Cadastre no GitHub Actions o secret `EXPO_TOKEN`, gerado na conta do Expo com acesso ao projeto. O token de publicação é separado da credencial usada pelo Demand Service para enviar notificações.

Depois de um push na `main`, o job **Publicar OTA Android preview** espera os testes unitários e compara o commit com a base validada do APK e da API. A execução manual da mesma workflow na `main` permite repetir uma publicação. O destino é apenas Android no canal `preview`.

Se houver mudanças de backend, dependências ou configuração nativa desde a base, o job pausa a publicação. Conclua o deploy da API ou gere e valide o novo APK antes de definir a variável de Actions `EXPO_PREVIEW_BASE_SHA` para o commit que representa o ambiente validado. A base inicial é a publicação de Android validada na PR #9. A verificação de caminhos é conservadora e a revisão da PR deve confirmar a compatibilidade com o APK.
