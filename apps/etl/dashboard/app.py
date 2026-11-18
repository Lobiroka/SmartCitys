import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.product_queries import pipeline_runs, query, regional_indicators


LABELS = {"REGIAO_METROPOLITANA_DO_RECIFE": "Região Metropolitana do Recife",
          "ZONA_DA_MATA": "Zona da Mata", "AGRESTE": "Agreste", "SERTAO": "Sertão", "OUTRA": "Outra"}

st.set_page_config(page_title="Observatório SmartCity", page_icon="🌆", layout="wide")
st.title("Observatório SmartCity")
st.caption("Ocorrências do aplicativo e contexto de população e saneamento do IBGE · dados tratados no Neon")


@st.cache_data(ttl=60)
def load_product():
    return (pd.DataFrame(regional_indicators()),
            pd.DataFrame(query("SELECT * FROM public.smartcity_ibge_bairros ORDER BY bairro")),
            pd.DataFrame(query("SELECT * FROM public.smartcity_ocorrencias_categoria")),
            pd.DataFrame(pipeline_runs()))


if st.button("Atualizar consulta ao banco"):
    st.cache_data.clear()

try:
    regions, neighborhoods, categories, runs = load_product()
except Exception:
    st.error("Não foi possível ler a base analítica. Confira DATABASE_URL e execute a pipeline integrada.")
    st.code("python orchestrate_prefect.py --engine spark")
    st.stop()

if runs.empty:
    st.info("Nenhuma publicação integrada concluída. Execute a pipeline antes de consultar o produto.")
    st.stop()

st.caption(f"Última publicação: {runs.iloc[0]['publicado_em']} · motor: {runs.iloc[0]['motor']}")
selected = st.selectbox("Região informada nas ocorrências", ["TODAS", *LABELS],
                        format_func=lambda value: LABELS.get(value, "Todas as regiões"))
filtered = regions if selected == "TODAS" else regions[regions.regiao == selected]
cols = st.columns(4)
for col, title, field in zip(cols, ("Ocorrências", "Abertas", "Em análise", "Resolvidas"),
                             ("ocorrencias", "abertas", "em_analise", "resolvidas")):
    col.metric(title, int(filtered[field].sum()))
st.subheader("Demandas por região")
display = filtered.copy()
display["regiao"] = display.regiao.map(LABELS)
st.dataframe(display[["regiao", "ocorrencias", "ocorrencias_saneamento", "saneamento_pendentes",
                      "alta_prioridade_pendentes", "primeiro_registro", "ultimo_registro"]],
             hide_index=True, use_container_width=True)
if not categories.empty:
    subset = categories if selected == "TODAS" else categories[categories.regiao == selected]
    st.bar_chart(subset.groupby("categoria")["ocorrencias"].sum())

st.subheader("Contexto IBGE disponível na pipeline")
if selected in ("TODAS", "REGIAO_METROPOLITANA_DO_RECIFE"):
    st.warning("O IBGE disponível cobre somente o município do Recife, Censo 2010. "
               "As ocorrências usam regiões amplas e datas próprias. Não há vínculo por bairro "
               "no cadastro atual; esses dados não permitem calcular ocorrências por habitante "
               "da região nem afirmar uma correlação por bairro.")
    context = regions[regions.regiao == "REGIAO_METROPOLITANA_DO_RECIFE"].iloc[0]
    left, middle, right = st.columns(3)
    left.metric("Bairros do Recife", int(context.bairros_ibge))
    middle.metric("População de Recife · 2010", "Sem dado completo" if pd.isna(context.populacao_municipio_contexto)
                  else f"{int(context.populacao_municipio_contexto):,}".replace(",", "."))
    coverage = context.cobertura_esgoto_municipio_contexto
    right.metric("Cobertura de rede geral · Recife · 2010",
                 "Sem dado completo" if pd.isna(coverage) else f"{float(coverage):.2f}%")
    st.caption("Cobertura = soma dos domicílios ligados à rede ÷ soma dos domicílios totais. "
               "Rede geral de esgoto ou pluvial, conforme a categoria da fonte.")
    neighborhood = st.selectbox("Bairro do Recife · somente dados IBGE", ["Todos", *neighborhoods.bairro])
    subset = neighborhoods if neighborhood == "Todos" else neighborhoods[neighborhoods.bairro == neighborhood]
    st.dataframe(subset[["bairro", "populacao", "domicilios_total", "domicilios_rede_geral",
                         "percentual_rede_esgoto", "ano"]], hide_index=True, use_container_width=True)
else:
    st.info("A extração atual não tem indicadores IBGE para esta região.")

with st.expander("Pipeline e rastreabilidade para apresentação"):
    st.write("API IBGE e banco SmartCity → MongoDB (bronze) → validação e Spark → "
             "Neon (prata e views ouro) → dashboard e MCP. O produto consulta somente o Neon.")
    st.dataframe(runs, hide_index=True, use_container_width=True)
    st.caption("Cada execução identifica os lotes usados, o motor e as contagens publicadas. "
               "Reexecutar o mesmo conteúdo reutiliza a bronze e mantém as chaves da prata.")

st.download_button("Baixar recorte regional", display.to_csv(index=False).encode("utf-8-sig"),
                   "smartcity_indicadores.csv", "text/csv")
