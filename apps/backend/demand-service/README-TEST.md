# Relatório da Suíte de Testes - Demand Service

---

##  1. Identificação do SUT (System Under Test)
* **Módulo:** `demand-service` (`resolve-backend-ilbs`)
* **Ferramenta:** Vitest
* **Arquitetura:** Microsserviço backend em Node.js (Express, Prisma ORM, PostgreSQL e Redis) com autenticação baseada em JSON Web Tokens (JWT).

---

##  2. Endpoints Contemplados
* **`POST /demandas`**: Criação e persistência de novas denúncias urbanas, contemplando autenticação, validação de perfis, geolocalização e campos obrigatórios.
* **`GET /demandas/my-demands`**: Listagem paginada das denúncias registradas pelo próprio cidadão autenticado.
* **`GET /demandas/feed`**: Listagem pública ou feed geral de ocorrências com suporte a paginação.
* **`GET /demandas/gestor/my-demands`**: Listagem de demandas filtrada sob a perspectiva do perfil de gestor com paginação.

---

##  3. Relação dos Cenários Automatizados

### **Criação de Ocorrências (`POST /demandas`)**
* Sucesso na criação com retorno **HTTP 201** e persistência correta de categoria e região.
* Atribuição automática do status padrão **`ABERTA`**.
* Atribuição automática da prioridade padrão **`MEDIA`** quando omitida no payload.
* Bloqueio com **HTTP 401** para requisições sem token de autenticação.
* Bloqueio com **HTTP 403** e mensagem de acesso negado para usuários com perfil de gestor.
* Tratamento de erro com **HTTP 400** para corpo da requisição vazio.
* Tratamento de erro com **HTTP 400** para envio de categorias ou regiões inexistentes.
* Validação de concorrência com requisições simultâneas via `Promise.all` garantindo a unicidade do cadastro do cidadão.
* Validação de dados geográficos com bloqueio **HTTP 400** por ausência de coordenadas.

### **Filtros Avançados e Paginação**
* Paginação correta com parâmetros `?page=1&limit=2` retornando o total de registros e páginas esperado.
* Tratamento de página inexistente (`?page=999`) retornando array vazio.
* Listagem paginada para o feed geral e painel do gestor.
* Tratamento de listagem vazia para cidadãos sem ocorrências cadastradas.

---

## 4. Código-Fonte da Suíte de Testes
A suíte completa de testes de integração e BDD encontra-se versionada na pasta de testes do projeto.
* **Referência do arquivo principal: https://github.com/Lobiroka/backend-bw/tree/eddf82a9bfd3bc5c8509d4efbe26b4d9db2e08ca/demand-service/src/tests

---

## ⚙️ 5. Instruções de Configuração e Execução

1. **Instalar as dependências:**
   ```bash
   npm install
   
2. **Subir o Docker Compose** 
   ```bash
   docker compose up -d
   
3. **Mudar Diretorio**
    ```bash
    cd demand-service
   
4. **Criar o .ENV**
   ```bash
   DATABASE_URL="postgresql://postgres.seu_projeto_id:sua_senha@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   JWT_SECRET=change-me

5. **Rodar o teste**
   ```bash
    npx vitest run

##  6. Evidencias da execucao dos testes.
![img.png](img.png)

## 7. Breve analise dos resutlados obtidos
   Todos os testes propostos passaram, e todos os testes que era para ser 'pulados' por falta de implementacao foram

## 8. Registro dos integrantes do Squad e das respectivas contribuições para a atividade.
   Todos contribuiram revisando uma parte dos testes corrigindo e configurando o ambiente.


