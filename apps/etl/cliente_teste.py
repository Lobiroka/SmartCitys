import argparse
import asyncio
import json

from fastmcp import Client

from servidor import mcp


def exibir_resultado(nome, resultado):

    dados = resultado.structured_content
    if dados is None:
        dados = resultado.data
    print(f"\n{nome}:", json.dumps(dados, ensure_ascii=False, indent=2, default=str))


async def main(pergunta=None):
    async with Client(mcp) as cliente:
        print("Ferramentas disponíveis:")
        for ferramenta in await cliente.list_tools():
            print(f" - {ferramenta.name}: {ferramenta.description}")
        tabelas = (await cliente.call_tool("listar_tabelas", {})).data
        print("\nTabelas:", tabelas)
        tabela = ("smartcity_ibge_bairros" if "smartcity_ibge_bairros" in tabelas
                  else "recife_populacao_saneamento")
        if tabela in tabelas:
            for nome, parametros in [
                ("descrever_tabela", {"tabela": tabela}),
                ("contar_linhas", {"tabela": tabela}),
                ("executar_select", {"sql": f"SELECT * FROM {tabela} ORDER BY bairro"}),
            ]:
                exibir_resultado(nome, await cliente.call_tool(nome, parametros))
        if "smartcity_indicadores_regiao" in tabelas:
            exibir_resultado("Indicadores SmartCity", await cliente.call_tool("indicadores_smartcity", {}))
            exibir_resultado("Auditoria", await cliente.call_tool("auditoria_pipeline", {}))
        if pergunta:
            resultado = await cliente.call_tool("perguntar_ao_banco", {"pergunta": pergunta})
            exibir_resultado("Resposta", resultado)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cliente de teste do servidor MCP da aula 10.")
    parser.add_argument("--pergunta", help="Opcional: requer chave de API no .env.")
    args = parser.parse_args()
    asyncio.run(main(args.pergunta))
