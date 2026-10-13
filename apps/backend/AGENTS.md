# AGENTS.md

## 1. Sobre o projeto

Este projeto é um aplicativo mobile de denúncias urbanas baseado em mapa.

O usuário poderá:
- visualizar denúncias no mapa;
- criar novas denúncias;
- adicionar descrição e categoria;
- adicionar fotos;
- acompanhar denúncias;
- autenticar-se através do Keycloak.

---

## 2. Stack

### Mobile
- React Native
- Expo
- TypeScript

### Backend
- Node.js
- TypeScript
- Express

### Autenticação
- Keycloak

O Keycloak é responsável por:
- login;
- registro;
- recuperação de senha;
- MFA;
- provedores sociais.

O backend NÃO implementa autenticação própria.
O backend deve validar os tokens emitidos pelo Keycloak.

### Banco
- PostgreSQL

### Infraestrutura
- Docker / Docker Compose
- Keycloak executado separadamente
- Backend containerizado

---

## 3. Arquitetura

Separar responsabilidades entre:

### Mobile
Responsável por:
- interface;
- navegação;
- interação com mapa;
- comunicação com API.

### Backend
Responsável por:
- regras de negócio;
- denúncias;
- usuários relacionados ao domínio;
- permissões;
- persistência;
- integração com serviços externos.

### Keycloak
Responsável exclusivamente por identidade e autenticação.

Não armazenar dados de negócio no Keycloak.

---

## 4. REGRA MAIS IMPORTANTE — Modo de aprendizado

Este projeto também tem finalidade educacional.

NÃO implemente funcionalidades inteiras automaticamente sem antes explicar.

Ao realizar uma tarefa:

1. Explique o conceito.
2. Explique por que essa abordagem será utilizada.
3. Mostre quais arquivos serão envolvidos.
4. Explique o código necessário.
5. Permita que eu tente implementar quando apropriado.
6. Analise o código que eu escrever.
7. Aponte erros e melhorias.

Evite simplesmente entregar código pronto quando o objetivo puder ser
alcançado me ensinando a implementá-lo.

Quando eu estiver com dificuldade, forneça pistas progressivamente antes
de entregar a solução completa.

---

## 5. Código

Utilizar TypeScript.

Evitar `any` sempre que possível.

Preferir código:
- simples;
- legível;
- tipado;
- modular;
- fácil de testar.

Não criar abstrações desnecessárias.

Não adicionar bibliotecas sem explicar:
- por que são necessárias;
- qual problema resolvem;
- quais alternativas existem.

---

## 6. Backend

Manter separação clara entre:

routes
controllers
services
repositories
middlewares
schemas/types

Controllers não devem conter regras complexas de negócio.

Services devem concentrar regras de negócio.

Repositories devem concentrar acesso aos dados.

---

## 7. Segurança

Nunca:
- colocar secrets no código;
- commitar `.env`;
- confiar em dados enviados pelo cliente;
- confiar apenas no frontend para autorização.

Tokens do Keycloak devem ser validados pelo backend.

Autenticação e autorização são conceitos diferentes e devem permanecer
separados.

---

## 8. Alterações no projeto

Antes de mudanças grandes:

1. analise a estrutura existente;
2. explique o problema;
3. apresente a solução proposta;
4. indique os arquivos afetados;
5. somente depois faça alterações.

Não refatore arquivos não relacionados à tarefa atual sem necessidade.

Não altere decisões arquiteturais existentes silenciosamente.

Se identificar uma arquitetura melhor, explique a proposta antes de
modificar o projeto.

---

## 9. Git

Preferir alterações pequenas e incrementais.

Não fazer commits automaticamente, a menos que solicitado.

Não alterar histórico Git.

Não executar comandos destrutivos sem autorização.

---

## 10. Testes

Ao implementar regras de negócio, considerar testes.

Explique:
- o que deve ser testado;
- por que deve ser testado;
- qual comportamento estamos garantindo.

Não criar testes apenas para aumentar cobertura.

---

## 11. Ao iniciar um novo chat

Antes de trabalhar em uma funcionalidade:

1. leia este AGENTS.md;
2. analise os arquivos relevantes;
3. verifique a implementação existente;
4. não assuma que algo existe sem verificar;
5. considere o código atual como fonte de verdade.

Se houver conflito entre documentação e implementação, informe antes
de prosseguir.