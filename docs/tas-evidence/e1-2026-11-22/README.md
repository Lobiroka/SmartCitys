# E1 — registrar, acompanhar e notificar

Validação local em 22/11/2026 da [PR #33](https://github.com/Lobiroka/SmartCitys/pull/33),
com código de teste no commit [a156a38](https://github.com/Lobiroka/SmartCitys/commit/a156a38902becb56e3f71a68782915e146cb7568).

## Resultado

Duas execuções consecutivas do mesmo cenário foram aprovadas, ambas com
zero falhas e código de saída 0:

| Execução | Duração do cenário | Evidências |
|---|---|---|
| Após iniciar o emulador sem snapshot | 2min26s | [JUnit](results.xml), [runner](execution.json) |
| Repetição sem reiniciar o emulador | 2min14s | [JUnit](repeat-results.xml), [runner](repeat-execution.json) |

A repetição manteve a limpeza dos dados do app e permitiu reutilizar a sessão
do navegador. O tempo do runner inclui a inicialização do Maestro e difere
da duração do cenário registrada no JUnit.

O fluxo confirmou, na mesma execução:

1. Registro pelo formulário do cidadão e identificação pelo título exclusivo.
2. Status `Aberta` na listagem.
3. Ausência inicial da mensagem de atualização na central do Android.
4. Alteração do registro para `EM_ANALISE` pela rota real de gestor.
5. Recebimento da notificação push real no Android.
6. Reabertura do app e status `Em análise` para o mesmo registro, sem `Aberta`.

Capturas revisadas, contendo dados fictícios do caso:

- [Ocorrência registrada](e1-registrada.png).
- [Notificação recebida](e1-notificacao-recebida.png).
- [Status atualizado](e1-status-atualizado.png).

## Ambiente e reprodução

Windows, Java 21, Maestro CLI 2.12.1, emulador `SmartCity_API_36`, tela
320×640/densidade 160, APK development e Metro local. O JavaScript da PR foi
carregado pelo Metro; a API utilizada foi `https://api.darkartsbm.com`.
Contas dedicadas de cidadão e gestor, com os perfis iniciais concluídos.
O token do gestor foi obtido pelo fluxo normal de código com PKCE e validado
pela API antes de executar o Maestro. Credenciais e tokens não são parte
destas evidências.

Seguir a preparação do [guia Maestro](../../../.maestro/README.md), incluindo
push real habilitado, Metro ativo, ADB reverse e `E2E_DEV_CLIENT=1`. O modo
de APK independente continua sendo o padrão do runner e da regressão.

## Diagnóstico e limites

As tentativas anteriores falharam na abertura do development client ou no
acesso ao formulário. A limpeza de dados apagava a conexão ao Metro; o menu
e o botão flutuante do Expo também cobriam controles do app. A correção usa
os parâmetros nativos do Expo SDK 57 para reabrir o projeto sem essas
ferramentas, mantendo limpeza, autenticação e todas as asserções do produto.

Também houve tentativas interrompidas e uma falha de ambiente
`DeviceServerDiedException`/`UNAVAILABLE`, sem resultado funcional válido.
O emulador foi iniciado sem carregar o snapshot antigo, preservando dados,
antes da execução aprovada. As falhas não foram transformadas em aprovação;
o sucesso documentado corresponde somente ao JUnit desta pasta.

A mensagem do push é genérica, portanto o caso requer conta dedicada sem
alterações concorrentes. Essas duas execuções não demonstram estabilidade
histórica nem substituem outras jornadas. A CI não executa esse push real:
os [checks do commit](https://github.com/Lobiroka/SmartCitys/actions/runs/45032615862)
validaram testes unitários/componentes e os scripts da TAS.
