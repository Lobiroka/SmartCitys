# Entrega 5 — Backup e continuidade

| Componente | O que preservar | Como recuperar |
| --- | --- | --- |
| RDS PostgreSQL | Bancos `smartcity` e `keycloak`, incluindo ocorrências e fotos atualmente armazenadas no banco | Restaurar um snapshot ou usar recuperação pontual em uma instância isolada. Reaplicar rede, parâmetros e permissões necessários e conferir os dados antes de trocar endpoints. |
| EC2 e gateway | Versão implantada no Git, configuração do Compose e do Caddy, referências aos segredos e configuração de rede | Recriar a instância ou restaurar o volume a partir de backup. Aplicar a configuração revisada, recuperar os segredos na origem autorizada e subir os serviços. |
| Keycloak | Configuração de implantação do Lightsail, domínio e acesso ao banco do Keycloak | Restaurar o serviço e apontar para o banco recuperado. Validar emissão de token e acesso com uma conta de teste. |
| ElastiCache Valkey | Configuração do serviço e inventário das filas e caches | Recriar o cache e confirmar o processamento de eventos. Verificar se há eventos pendentes que precisam de reprocessamento antes de descartar o estado anterior. |

## Ensaio de restauração

1. Registrar a retenção e a janela de backup do RDS, o último backup recuperável e a versão implantada. Definir o tempo máximo de indisponibilidade e a perda de dados aceitável antes do ensaio.
2. Restaurar o RDS em uma instância de teste com acesso restrito. Conferir os schemas, a tabela de migrações e a presença de registros de teste.
3. Subir uma cópia isolada dos serviços com os endpoints restaurados. Conferir `/health`, autenticação e a leitura e escrita de uma ocorrência fictícia.
4. Registrar início, fim, ponto recuperado, perda observada e resultado dos testes. Anexar à entrega os identificadores da restauração e as evidências sem credenciais.
5. Após registrar as evidências, remover os recursos temporários conforme a política da equipe.

**Estado.** Roteiro preparado. Retenção efetiva, objetivos de recuperação e ensaio de restauração pendentes.

[Restauração de snapshot no RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RestoreFromSnapshot.html) · [Recuperação pontual no RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
