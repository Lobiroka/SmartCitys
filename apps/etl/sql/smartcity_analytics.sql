CREATE TABLE IF NOT EXISTS public.smartcity_ibge_bairros (
    codigo_bairro TEXT PRIMARY KEY,
    bairro TEXT NOT NULL,
    populacao BIGINT CHECK (populacao >= 0),
    domicilios_total BIGINT CHECK (domicilios_total >= 0),
    domicilios_rede_geral BIGINT CHECK (domicilios_rede_geral >= 0),
    percentual_rede_esgoto NUMERIC(5,2) CHECK (percentual_rede_esgoto BETWEEN 0 AND 100),
    ano INTEGER NOT NULL CHECK (ano = 2010),
    lote_id TEXT NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL,
    CHECK (domicilios_rede_geral <= domicilios_total)
);

CREATE TABLE IF NOT EXISTS public.smartcity_ocorrencias (
    id_denuncia BIGINT PRIMARY KEY CHECK (id_denuncia > 0),
    categoria TEXT NOT NULL,
    regiao TEXT NOT NULL CHECK (regiao IN
        ('REGIAO_METROPOLITANA_DO_RECIFE','ZONA_DA_MATA','AGRESTE','SERTAO','OUTRA')),
    status TEXT NOT NULL CHECK (status IN ('ABERTA','EM_ANALISE','RESOLVIDA')),
    prioridade TEXT NOT NULL CHECK (prioridade IN ('ALTA','MEDIA','BAIXA')),
    data_registro TIMESTAMPTZ NOT NULL,
    lote_id TEXT NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS smartcity_ocorrencias_regiao_idx ON public.smartcity_ocorrencias(regiao);

CREATE TABLE IF NOT EXISTS public.smartcity_pipeline_execucoes (
    execucao_id UUID PRIMARY KEY,
    inicio TIMESTAMPTZ NOT NULL,
    publicado_em TIMESTAMPTZ NOT NULL,
    motor TEXT NOT NULL,
    lotes JSONB NOT NULL,
    bairros INTEGER NOT NULL,
    ocorrencias INTEGER NOT NULL
);

CREATE OR REPLACE VIEW public.smartcity_indicadores_regiao AS
WITH regioes(regiao) AS (VALUES
    ('REGIAO_METROPOLITANA_DO_RECIFE'), ('ZONA_DA_MATA'), ('AGRESTE'), ('SERTAO'), ('OUTRA')
), ocorrencias AS (
    SELECT regiao, COUNT(*) AS ocorrencias,
        COUNT(*) FILTER (WHERE status = 'ABERTA') AS abertas,
        COUNT(*) FILTER (WHERE status = 'EM_ANALISE') AS em_analise,
        COUNT(*) FILTER (WHERE status = 'RESOLVIDA') AS resolvidas,
        COUNT(*) FILTER (WHERE status <> 'RESOLVIDA' AND prioridade = 'ALTA') AS alta_prioridade_pendentes,
        COUNT(*) FILTER (WHERE categoria = 'SANEAMENTO') AS ocorrencias_saneamento,
        COUNT(*) FILTER (WHERE categoria = 'SANEAMENTO' AND status <> 'RESOLVIDA') AS saneamento_pendentes,
        MIN(data_registro) AS primeiro_registro, MAX(data_registro) AS ultimo_registro
    FROM public.smartcity_ocorrencias GROUP BY regiao
), ibge AS (
    SELECT COUNT(*) AS bairros,
        CASE WHEN COUNT(populacao) = COUNT(*) THEN SUM(populacao) END AS populacao,
        CASE WHEN COUNT(domicilios_total) = COUNT(*) AND COUNT(domicilios_rede_geral) = COUNT(*)
             THEN ROUND(100.0 * SUM(domicilios_rede_geral) / NULLIF(SUM(domicilios_total),0),2)
        END AS cobertura_rede_esgoto,
        COUNT(*) FILTER (WHERE domicilios_total IS NOT NULL AND domicilios_rede_geral IS NOT NULL)
            AS bairros_com_saneamento,
        MIN(ano) AS ano
    FROM public.smartcity_ibge_bairros
)
SELECT r.regiao, COALESCE(o.ocorrencias,0) AS ocorrencias,
    COALESCE(o.abertas,0) AS abertas, COALESCE(o.em_analise,0) AS em_analise,
    COALESCE(o.resolvidas,0) AS resolvidas,
    COALESCE(o.alta_prioridade_pendentes,0) AS alta_prioridade_pendentes,
    COALESCE(o.ocorrencias_saneamento,0) AS ocorrencias_saneamento,
    COALESCE(o.saneamento_pendentes,0) AS saneamento_pendentes,
    o.primeiro_registro, o.ultimo_registro,
    CASE WHEN r.regiao = 'REGIAO_METROPOLITANA_DO_RECIFE' THEN 'Recife' END AS municipio_contexto,
    CASE WHEN r.regiao = 'REGIAO_METROPOLITANA_DO_RECIFE' THEN i.ano END AS ano_ibge,
    CASE WHEN r.regiao = 'REGIAO_METROPOLITANA_DO_RECIFE' THEN i.bairros END AS bairros_ibge,
    CASE WHEN r.regiao = 'REGIAO_METROPOLITANA_DO_RECIFE' THEN i.bairros_com_saneamento END AS bairros_com_saneamento,
    CASE WHEN r.regiao = 'REGIAO_METROPOLITANA_DO_RECIFE' THEN i.populacao END AS populacao_municipio_contexto,
    CASE WHEN r.regiao = 'REGIAO_METROPOLITANA_DO_RECIFE' THEN i.cobertura_rede_esgoto END AS cobertura_esgoto_municipio_contexto,
    CASE WHEN r.regiao = 'REGIAO_METROPOLITANA_DO_RECIFE'
        THEN 'IBGE cobre somente Recife (Censo 2010); ocorrências abrangem a região informada no app. Não são territórios nem períodos equivalentes.'
        ELSE 'Sem indicadores IBGE para esta região na extração atual.' END AS nota_territorial
FROM regioes r LEFT JOIN ocorrencias o USING (regiao) CROSS JOIN ibge i;

CREATE OR REPLACE VIEW public.smartcity_ocorrencias_categoria AS
SELECT regiao, categoria, status, COUNT(*) AS ocorrencias
FROM public.smartcity_ocorrencias GROUP BY regiao, categoria, status;
