# Testes do Demand Service

A suíte Vitest/Supertest exercita Express com PostgreSQL real em banco exclusivo. Tokens e JWKS são fixtures locais; o transporte de push é simulado. Não exige credenciais privadas de Keycloak, AWS ou Expo.

Na raiz do repositório, com Docker ativo:

```bash
npm run team:backend -- test
```

O comando cria/inicia PostgreSQL e Redis de testes, aplica migrations e executa os testes. Os dados de desenvolvimento e do RDS não são usados. Para desligar a stack sem remover volumes:

```bash
npm run team:backend -- down
```

## Execução manual em banco isolado

Em `apps/backend/demand-service`, instale dependências com `npm ci` e gere o cliente com `npx prisma generate`. Configure `TEST_DATABASE_URL` para um PostgreSQL exclusivo, com o schema `demand` criado e as migrations aplicadas usando `DATABASE_URL` desse mesmo banco. Execute `npm test`. A configuração global recusa executar sem `TEST_DATABASE_URL`; não use uma URL compartilhada.

## Cobertura e limites

Cada teste e cada hook de preparação/limpeza têm limite de **30 segundos** no
Vitest. O cliente Prisma usado pela aplicação dentro da suíte continua acessando
o PostgreSQL real, com **15 segundos** para transações interativas. Essa configuração
fica em `src/tests/setupAuth.ts` e se aplica somente aos testes; o cliente da API
publicada permanece com sua configuração própria. A espera para adquirir uma
transação mantém o padrão do Prisma.

Os prazos foram ampliados após a [regressão 45401325535](https://github.com/Lobiroka/SmartCitys/actions/runs/45401325535),
acompanhada na [issue #46](https://github.com/Lobiroka/SmartCitys/issues/46), registrar
dois timeouts de 5 segundos e expiração de transação após cerca de 7,1 segundos.
`transactionTimeout.test.ts` verifica uma operação SQL de 6 segundos no banco
isolado, garantindo que ampliar só o prazo do Vitest não deixe o antigo limite
de transação ativo. O teste não grava dados. Falhas acima dos novos limites
continuam reprovando a suíte; não há retry automático nem testes desativados.

- Criação com endereço ou GPS, autenticação e validação de campos.
- Papéis cidadão/gestor, propriedade e controle de edição/exclusão.
- Persistência de imagens, consultas próprias, feed e paginação.
- Alteração de status/prioridade e histórico pelo gestor.
- Registro e remoção de inscrições push; envio simulado ao proprietário correto.
- Seis cenários de filtros avançados continuam ignorados na suíte existente porque esses filtros ainda não são aplicados pela API. Teste ignorado não significa aprovação.

O prefixo de teste direto é `/demandas`; no Gateway, o contrato externo é `/demands`. O feed exige autenticação. A listagem administrativa é `GET /demandas/gestor`; não existe `/gestor/my-demands`.

Os testes não comprovam cadastro no Keycloak, câmera/GPS nativos ou push no Android. Essas etapas exigem execução integrada no Android. O contrato completo está em [OpenAPI](../../../docs/api/openapi.json).
