# Preparar a distribuição Android

O perfil `preview` do EAS Build gera um APK assinado para distribuição interna. O mesmo APK recebe atualizações compatíveis do canal `preview`.

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

No app, o cidadão pode ativar ou desativar notificações pelo menu do perfil. Depois de ativá-las em um celular, mude o status de uma ocorrência dele com a conta gestora. Confira a entrega com o app em primeiro e segundo plano. O logout remove a inscrição desse aparelho quando a API está acessível.

## APK e OTA

Gere o APK depois de concluir a configuração de credenciais, a publicação da API e os testes anteriores que podem ser executados com o app de desenvolvimento. Rode os comandos abaixo em `apps/mobile`.

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest update --channel preview --environment preview --message "Atualização do piloto Android"
```

O segundo comando é usado depois que o primeiro APK compatível estiver instalado. Valide a OTA com uma mudança visual pequena no canal `preview`. A configuração usa `appVersion` como política de runtime. Quando houver mudança de código ou configuração nativa, aumente `expo.version` e gere outro APK. Mantenha a mesma versão para atualizações JavaScript e de assets compatíveis com o APK existente.
