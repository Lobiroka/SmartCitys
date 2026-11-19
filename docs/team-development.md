# Ambiente de desenvolvimento da equipe

## Objetivo e limites

Cada integrante desenvolve em sua branch, usa sua própria conta no Keycloak e pode executar a API com PostgreSQL e Redis locais. A API HTTPS na AWS continua sendo a referência compartilhada de integração; alterar o código na máquina do colega não modifica essa API.

Não compartilhar senha do Robson, chave SSH da EC2, credenciais IAM, senha do RDS, keystore, token de publicação Expo ou JSON privado de conta de serviço Firebase. O arquivo `google-services.json` do aplicativo é configuração cliente, diferente do JSON privado do Firebase Admin. A chave Android do Maps também está no APK e pode ser extraída: usar um APK compilado centralmente evita distribuir chaves para configuração manual, mas não torna uma chave cliente um segredo. Restringir o Maps ao pacote Android, certificados autorizados e Maps SDK for Android, com acompanhamento de consumo.

Referências: [segurança do Maps](https://developers.google.com/maps/api-security-best-practices), [credenciais cliente e privadas do Firebase](https://firebase.google.com/support/guides/security-checklist), [compartilhar clientes de desenvolvimento Expo](https://docs.expo.dev/develop/development-builds/share-with-your-team/).

## Quem recebe qual acesso

| Recurso | Integrante da equipe | Responsável pela infraestrutura |
|---|---|---|
| GitHub | Acesso ao repositório e branch própria; PR sujeita aos rulesets | Revisão e integração conforme CODEOWNERS |
| Keycloak | Conta pessoal no realm de testes, com papel cidadão; gestor somente quando autorizado | Administração do realm e concessão de papéis |
| API AWS | URL pública HTTPS e token da própria sessão | Publicação e configuração dos serviços |
| Banco/cache local | Credenciais aleatórias geradas no computador do próprio integrante | Nenhuma credencial AWS necessária |
| Expo | Link do APK development; não precisa de token de publicação para usar o Metro local | Compilação nativa, assinatura e publicação |
| Maps/Firebase | Recursos presentes no cliente development instalado | Restrições da chave e configuração privada dos serviços |

Nesta etapa, não é necessário conceder acesso IAM, SSH, RDS, console Firebase ou publicação Expo aos colegas. Um APK pode ser analisado por quem o recebe; somente credenciais de cliente podem estar nele. Dar acesso a builds que executam código arbitrário com secrets também permite extrair esses secrets; não tratar permissão de build como equivalente a apenas baixar o aplicativo.

## 1. Preparação de cada computador

Instalar Git, Node.js 22 LTS, Docker Desktop com containers Linux e Android Studio/SDK. Criar um emulador Android dedicado ao desenvolvimento, preferencialmente com Google Play para Maps e notificações. O fluxo abaixo cobre Android por USB ou emulador; iOS exige sua configuração de assinatura própria e não é configurado por estes comandos.

Na primeira vez:

```powershell
git clone https://github.com/Lobiroka/SmartCitys.git
cd SmartCitys
npm.cmd ci
git switch -c feature/minha-alteracao
```

Criar a própria conta pela tela de registro do Keycloak. Nunca reutilizar a conta administrativa ou a conta de E2E da CI. Caso a funcionalidade exija gestor, pedir ao responsável para atribuir o papel à conta individual. As permissões continuam sendo verificadas pela API.

## 2. Instalar o cliente DEVELOPMENT uma vez

O responsável gera e distribui um APK pelo perfil EAS `development`. Esse APK contém o cliente Expo que carrega o JavaScript do computador de cada integrante. O APK `preview` 1.0.1 é para avaliar a aplicação pronta e não substitui esse cliente.

Build development da equipe: [abrir no Expo e baixar o APK](https://expo.dev/accounts/dkartss-team/projects/wb/builds/103030d5-f0d1-4134-a6c2-5f0458cc7931). Conferir o estado **Finished** antes de instalar; o build foi solicitado a partir do commit `84ffdb9`, integrado pela PR #21.

O perfil `development` usa as variáveis já cadastradas no ambiente EAS `preview` apenas para a compilação centralizada, com canal `development`. Isso evita copiar o arquivo Firebase ou a chave do Maps para a máquina dos colegas. O backend padrão e o Keycloak ainda são os de testes atuais; não foi criado outro ambiente AWS. O perfil `preview` continua separado.

O pacote Android permanece `com.darkartsbm.smartcitys`. Um APK development pode ter certificado diferente do preview: use um emulador dedicado para não substituir o aplicativo de avaliação nem perder seus dados. Se desejar os dois apps no mesmo celular, uma variante com pacote e configuração Firebase próprios será uma evolução separada. Conferir o SHA-1 do APK development e autorizar somente esse certificado na chave Maps antes de distribuir. Não abrir a chave para todos os aplicativos.

No computador do responsável, a partir de `apps/mobile`, com a configuração nativa carregada sem exibir valores:

```powershell
npx.cmd eas-cli@27.7.1 build --platform android --profile development
```

Compartilhar somente o link do APK concluído. O build usa as credenciais guardadas no EAS; o JSON privado de envio FCM permanece no serviço responsável pelo push. Alterar bibliotecas nativas, plugins, pacote ou permissões exige novo cliente development compilado pelo responsável. Alterações comuns de TypeScript, telas e regras JavaScript são recarregadas pelo Metro.

## 3. Desenvolver o app usando a API compartilhada

Depois de instalar o APK development e abrir o emulador, executar na raiz:

```powershell
npm.cmd run team:android
```

O comando:

1. Cria `apps/mobile/.env.team.local` a partir do exemplo público, sem sobrescrever um arquivo existente.
2. Carrega URLs, cliente público Keycloak e ID público Expo. Ignora o `.env.local` pessoal e não repassa as variáveis nativas Maps/Firebase ao Metro.
3. Usa o cliente nativo já instalado: a configuração permite iniciar o Metro sem uma chave de compilação.
4. Encaminha a porta 8081 por ADB e abre o desenvolvimento no Android conectado.

Manter apenas um Android conectado: o Expo abre o primeiro dispositivo disponível e não usa `ANDROID_SERIAL` para essa escolha. O script interrompe se houver mais de um aparelho autorizado, não inicia ou baixa um emulador, não instala APK automaticamente e não conecta por túnel público. Para testar o carregamento da configuração sem iniciar o app: `npm.cmd run team:android -- --check`.

O app chama `https://api.darkartsbm.com` e autentica em `https://auth.darkartsbm.com/realms/smartcitys-test`. Esses endereços e o client ID não são credenciais privadas. Dados e permissões desse ambiente são compartilhados: usar somente dados fictícios identificados pelo integrante. Uma conta gestora pode acessar outras ocorrências de teste conforme as regras do produto; esta API compartilhada não é um sandbox individual.

## 4. Alterar e executar o backend local

Na raiz, com Docker iniciado:

```powershell
npm.cmd run team:backend -- up
curl.exe http://127.0.0.1:8080/health
```

O comando gera duas senhas aleatórias em `apps/backend/.env.team.local`, ignorado pelo Git. Ele compila as imagens de desenvolvimento, inicializa PostgreSQL/Redis, aplica as migrations e inicia Demand, Metrics e Gateway com recarga do código TypeScript.

- Gateway: `127.0.0.1:8080`.
- PostgreSQL de desenvolvimento: `127.0.0.1:5433`, banco `smartcitys_dev`.
- PostgreSQL de testes: `127.0.0.1:5434`, banco `smartcitys_test`, iniciado somente ao testar.
- Redis de desenvolvimento e Redis de testes são containers diferentes, sem porta exposta no host. Isso também separa filas e eventos Pub/Sub.
- Demand e Metrics ficam acessíveis pela rede interna do Compose, não por portas abertas na máquina.
- Volumes preservam dados ao desligar. As credenciais locais não devem ser usadas na AWS.

O ambiente usa os arquivos de cada serviço da branch atual, mas não carrega o `.env.local` pessoal do backend nem recebe URLs/senhas do RDS. Não existe comando automático de reset, exclusão de volumes ou publicação na AWS.

Para usar esse backend no app:

```powershell
npm.cmd run team:android:local
```

Esse modo encaminha também a porta 8080 via ADB e usa `http://127.0.0.1:8080`. A autenticação continua no Keycloak de testes, com a conta individual. Para Android físico, conectar por USB e habilitar sua depuração; o backend está restrito ao loopback e não fica aberto na rede local. O cliente development deve permitir o tráfego HTTP de desenvolvimento; isso não altera o requisito HTTPS dos APKs distribuídos pelo perfil preview.

Comandos de operação:

```powershell
npm.cmd run team:backend -- logs
npm.cmd run team:backend -- migrate
npm.cmd run team:backend -- down
```

Depois de trocar de branch ou alterar dependências, executar `up` novamente. Ele recompila e renova somente os volumes anônimos de dependências, preservando os volumes nomeados dos bancos. Usar uma stack por computador de cada vez; parar com `down` antes de trocar entre checkouts. Não executar dois projetos locais na mesma porta.

Se apagar o arquivo de senhas mas manter os volumes, as credenciais novas não corresponderão ao banco antigo. Preservar esse arquivo local junto ao ambiente. Não publicar seu conteúdo nem usar `docker compose config` sem `--quiet` em logs compartilhados, pois essa saída expande as senhas.

## 5. Testes e mudanças de banco

Testes mobile:

```powershell
npm.cmd run mobile:test
```

Testes da API no banco e Redis exclusivos:

```powershell
npm.cmd run team:backend -- test
```

Os testes da API criam e removem dados. Esse comando usa somente `smartcitys_test` e `redis-test`, não o banco do desenvolvimento nem o RDS. As chaves de assinatura usadas nos testes são fixtures da própria suíte. Testes de push simulam o transporte e não precisam do token real.

Ao modificar o schema Prisma de Demand:

```powershell
npm.cmd run team:backend -- migration nome_da_mudanca
npm.cmd run team:backend -- migrate
npm.cmd run team:backend -- up
npm.cmd run team:backend -- test
```

O primeiro comando cria a migration no diretório Prisma da branch, usando o banco local e `--create-only`. Revisar o SQL, versionar schema e migration juntos e não modificar migrations já aplicadas. A publicação em AWS/RDS é uma etapa posterior, feita pelo responsável após revisão da PR. Usar um banco exclusivo ou executar com o responsável qualquer ensaio de rollback/continuidade.

Sem `EXPO_PUSH_ACCESS_TOKEN`, o serviço local não envia notificações reais. Alterações no envio e recebimento completo de push devem ser aprovadas e validadas no ambiente de integração pelo responsável. O colega pode modificar e testar a lógica com os mocks existentes; não precisa receber a credencial privada de envio.

## 6. Integração, publicação e responsabilidades

1. Cada integrante faz commits na própria branch, executa seus testes e abre uma PR.
2. Os rulesets exigem os checks e a revisão do Code Owner, conforme configurado. A PR não publica o backend do colega na AWS.
3. O responsável revisa o código. Mudanças de infraestrutura, migrations ou integrações são implantadas no ambiente compartilhado com as credenciais de servidor.
4. Após aprovação da integração, publicar OTA ou gerar APK compatível conforme o guia de preview. Não distribuir login, keystore ou token de publicação para permitir testes locais.

O workflow **Ambiente local da equipe** verifica a configuração, inicializa a stack a partir de banco novo, reaplica migrations e executa a API contra o banco de testes. Ele usa credenciais aleatórias locais e não recebe secrets AWS/Firebase. Esse check complementa os testes unitários; sua exigência para merge pode ser adicionada ao ruleset quando a equipe decidir.

Este fluxo não cria sandboxes de backend por PR na AWS, novos usuários IAM ou acessos administrativos. Se a equipe precisar de deploys independentes em nuvem, será necessário projetar ambientes e dados isolados, além de um pipeline de publicação com permissões limitadas e aprovação. O acesso ao código da API não concede acesso administrativo à infraestrutura atual.

## Pendências de ativação

Configuração integrada pela [PR #21](https://github.com/Lobiroka/SmartCitys/pull/21). Validação: 55 testes mobile passaram, incluindo cinco verificações da configuração do cliente. A [CI da stack local](https://github.com/Lobiroka/SmartCitys/actions/runs/44577588376) passou com banco novo, reaplicação de migrations, saúde dos três serviços e testes da API: 26 passaram e seis permanecem desativados pela suíte existente.

A checagem TypeScript ainda aponta uma declaração ausente para o import de `global.css` em `app/_layout.tsx`, anterior a este ambiente; não considerar a checagem de tipos integralmente aprovada. Docker não está instalado na máquina usada para preparar esta configuração; a execução dos containers foi validada na CI.

- Conferir a conclusão do APK development no link registrado acima.
- Conferir certificado e mapa no Android antes de distribuir.
- Cada integrante criar sua conta e instalar as ferramentas; gestor somente quando autorizado.
- Fazer o primeiro ensaio em uma máquina da equipe: app com API compartilhada, app com API local e testes da API isolados.

Não considerar o onboarding homologado apenas pela existência do Compose; conferir a execução do workflow e o primeiro uso do cliente Android.
