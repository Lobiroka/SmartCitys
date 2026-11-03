"""Normaliza Jest/Vitest/JUnit e gera indicadores e HTML, sem pacotes externos."""
import argparse
import html
import json
import math
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCOPE = "Mobile: src/features/occurrences; exclui testes e ApiOccurrenceService.ts. Não representa todo o aplicativo. API e E2E sem cobertura instrumentada."


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def redact(text):
    for name, value in os.environ.items():
        if len(value) >= 5 and re.search(r"PASSWORD|TOKEN|SECRET|API_KEY|E2E_USERNAME", name):
            for variant in (value, html.escape(value), json.dumps(value)[1:-1]):
                text = text.replace(variant, "[REDACTED]")
    return re.sub(r"(postgres(?:ql)?://[^:\s/]+:)[^@\s]+(@)", r"\1[REDACTED]\2", text)


def clean_artifacts(root):
    for path in root.rglob("*"):
        if path.is_file() and path.suffix in {".json", ".xml", ".txt", ".log", ".html", ".info"}:
            path.write_text(redact(path.read_text(encoding="utf-8", errors="replace")), encoding="utf-8")


def read_suite(root, name, outcome):
    directory = root / name
    cases, problems = [], []
    duration = None
    exit_code = None
    try:
        if (directory / "execution.json").exists():
            execution = load_json(directory / "execution.json")
            duration, exit_code = execution["duration_seconds"], execution["exit_code"]
        if name == "e2e":
            tree = ET.parse(directory / "results.xml")
            for case in tree.iter("testcase"):
                failure = case.find("failure")
                error = case.find("error")
                detail = failure if failure is not None else error
                cases.append({"name": case.get("name", "E2E"),
                              "status": "failed" if detail is not None else "skipped" if case.find("skipped") is not None else "passed",
                              "message": "" if detail is None else "".join(detail.itertext()),
                              "seconds": float(case.get("time", "0"))})
            if duration is None:
                duration = sum(c["seconds"] for c in cases)
        else:
            data = load_json(directory / "results.json")
            for suite in data.get("testResults", []):
                assertions = suite.get("assertionResults", [])
                if suite.get("status") == "failed" and not any(a.get("status") == "failed" for a in assertions):
                    problems.append(suite.get("message") or "Falha ao carregar uma suíte de testes.")
                for case in assertions:
                    status = case.get("status")
                    cases.append({"name": case.get("fullName") or case.get("title", "Teste"),
                                  "status": "passed" if status == "passed" else "failed" if status == "failed" else "skipped",
                                  "message": "\n".join(case.get("failureMessages", [])),
                                  "seconds": (case.get("duration") or 0) / 1000})
            if data.get("numRuntimeErrorTestSuites", 0):
                problems.append("Erro de execução/carregamento de suíte.")
            if data.get("wasInterrupted"):
                problems.append("Execução interrompida.")
            if int(data.get("numTotalTests", len(cases))) != len(cases):
                problems.append("Contagem de testes divergente do resultado estruturado.")
        if not cases:
            problems.append("Nenhum caso de teste disponível.")
    except (OSError, ValueError, KeyError, TypeError, AttributeError, ET.ParseError) as error:
        problems.append(f"Resultado ausente ou inválido: {type(error).__name__}.")
    counts = {status: sum(c["status"] == status for c in cases) for status in ("passed", "failed", "skipped")}
    if outcome not in ("success", "failure"):
        problems.append("Etapa não executada, cancelada ou sem resultado confirmado.")
    if (exit_code not in (None, 0) or outcome == "failure") and counts["failed"] == 0:
        problems.append("Processo falhou sem registrar caso reprovado; investigar ambiente ou instrumentação.")
    if outcome == "success" and counts["failed"]:
        problems.append("Etapa informou sucesso apesar de casos reprovados.")
    return {"name": name, "outcome": outcome, "duration_seconds": duration,
            "counts": counts, "cases": cases, "problems": problems,
            "complete": not problems}


def write_junit(suite, path):
    counts = suite["counts"]
    tree = ET.Element("testsuites")
    group = ET.SubElement(tree, "testsuite", name=suite["name"],
                          tests=str(len(suite["cases"])), failures=str(counts["failed"]),
                          skipped=str(counts["skipped"]), errors=str(len(suite["problems"])))
    for case in suite["cases"]:
        item = ET.SubElement(group, "testcase", name=case["name"], time=str(case["seconds"]))
        if case["status"] == "failed":
            ET.SubElement(item, "failure").text = case["message"]
        elif case["status"] == "skipped":
            ET.SubElement(item, "skipped")
    for problem in suite["problems"]:
        item = ET.SubElement(group, "testcase", name="Infraestrutura ou coleta")
        ET.SubElement(item, "error").text = problem
    group.set("tests", str(len(group)))
    # XML 1.0 não aceita controles que podem vir de stacks/logs com cores ANSI.
    def xml_text(value):
        value = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", value)
        return "".join(c for c in value if c in "\t\n\r" or 0x20 <= ord(c) <= 0xD7FF
                       or 0xE000 <= ord(c) <= 0xFFFD or 0x10000 <= ord(c) <= 0x10FFFF)
    for item in tree.iter():
        if item.text:
            item.text = xml_text(item.text)
        for key, value in list(item.attrib.items()):
            item.set(key, xml_text(value))
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(tree).write(path, encoding="utf-8", xml_declaration=True)


def calculate(suites, coverage, job_status):
    counts = {s: sum(x["counts"][s] for x in suites) for s in ("passed", "failed", "skipped")}
    executed = counts["passed"] + counts["failed"]
    incomplete = job_status != "success" or any(not x["complete"] for x in suites) or not executed
    coverage_ok = all(coverage.get(k) is not None and coverage[k] >= 70 for k in ("lines", "branches", "functions", "statements"))
    if counts["failed"]:
        status = "VERMELHO"
        recommendation = "Corrigir os testes reprovados antes de aprovar a entrega."
    elif incomplete:
        status = "INCONCLUSIVO"
        recommendation = "Restabelecer a execução/coleta e repetir a validação; não há evidência suficiente para aprovar."
    elif not coverage_ok or counts["skipped"]:
        status = "AMARELO"
        recommendation = "Revisar lacunas de cobertura e testes ignorados antes da decisão de entrega."
    else:
        status = "VERDE"
        recommendation = "Critérios desta execução atendidos; avaliar também o aceite manual e o ambiente de destino."
    return {"counts": counts, "executed": executed,
            "success_rate": round(100 * counts["passed"] / executed, 2) if executed else None,
            "failure_rate": round(100 * counts["failed"] / executed, 2) if executed else None,
            "partial": incomplete, "status": status, "recommendation": recommendation}


def render(template, values):
    def replace(match):
        key = match.group(1)
        return values[key] if key.endswith("_HTML") else html.escape(str(values[key]))
    return re.sub(r"\{\{([A-Z_]+)\}\}", replace, template)


def build(root, expected, outcomes, job_status="success"):
    root.mkdir(parents=True, exist_ok=True)
    clean_artifacts(root)
    suites = [read_suite(root, name, outcomes.get(name, "skipped")) for name in expected]
    coverage = {}
    coverage_problem = None
    try:
        total = load_json(root / "mobile/coverage/coverage-summary.json")["total"]
        coverage = {k: float(total[k]["pct"]) for k in ("lines", "branches", "functions", "statements")}
        if any(not math.isfinite(value) or not 0 <= value <= 100 for value in coverage.values()):
            raise ValueError("Percentual inválido")
    except (OSError, ValueError, TypeError, KeyError):
        coverage = {}
        coverage_problem = "Cobertura indisponível; não é tratada como zero nem como meta atendida."
    result = calculate(suites, coverage, job_status)
    result.update({"suites": suites, "coverage": coverage, "coverage_scope": SCOPE,
                   "coverage_problem": coverage_problem, "workflow": os.getenv("GITHUB_WORKFLOW", "Local"),
                   "run": os.getenv("GITHUB_RUN_NUMBER", "local"), "attempt": os.getenv("GITHUB_RUN_ATTEMPT", "1"),
                   "commit": os.getenv("GITHUB_SHA", "local"), "date": datetime.now(timezone.utc).isoformat(),
                   "job_status_before_report": job_status})
    try:
        result["pipeline_seconds_until_report"] = round(time.time() - float((root / "started-at").read_text()), 3)
    except (OSError, ValueError):
        result["pipeline_seconds_until_report"] = None
    result["run_url"] = (f"{os.getenv('GITHUB_SERVER_URL', 'https://github.com')}/{os.getenv('GITHUB_REPOSITORY', '')}"
                         f"/actions/runs/{os.getenv('GITHUB_RUN_ID', '')}")
    risks = ["Este relatório descreve a execução testada; não comprova qualidade de todo o produto nem funcionamento da AWS."]
    if result["partial"]:
        risks.append("Resultados parciais: preparação, execução ou coleta não foi concluída.")
    if result["counts"]["failed"]:
        risks.append("Há testes reprovados; percentual agregado não anula uma falha funcional.")
    if result["counts"]["skipped"]:
        risks.append(f"{result['counts']['skipped']} testes ignorados não validaram funcionalidades nesta execução.")
    if coverage_problem:
        risks.append(coverage_problem)
    below_target = [k for k, value in coverage.items() if value < 70]
    if below_target:
        risks.append("Cobertura abaixo da meta inicial de 70%: " + ", ".join(below_target) + ".")
    list_html = lambda items: "".join(f"<li>{html.escape(str(item))}</li>" for item in items)
    suite_rows = "".join(f"<tr><td>{x['name']}</td><td>{x['counts']['passed']}</td><td>{x['counts']['failed']}</td><td>{x['counts']['skipped']}</td><td>{x['duration_seconds'] if x['duration_seconds'] is not None else 'N/D'}</td><td>{'Completa' if x['complete'] else 'Incompleta'}</td></tr>" for x in suites)
    failures = [f"{x['name']}: {c['name']} — {c['message']}" for x in suites for c in x["cases"] if c["status"] == "failed"]
    failures += [f"{x['name']}: {p}" for x in suites for p in x["problems"]]
    pct = lambda value: "N/D" if value is None else f"{value:.2f}%"
    values = {"WORKFLOW": result["workflow"], "RUN": result["run"], "ATTEMPT": result["attempt"],
              "COMMIT": result["commit"], "DATE": result["date"], "STATUS": result["status"],
              "EXECUTED": result["executed"], "PASSED": result["counts"]["passed"],
              "FAILED": result["counts"]["failed"], "SKIPPED": result["counts"]["skipped"],
              "SUCCESS_RATE": pct(result["success_rate"]), "FAILURE_RATE": pct(result["failure_rate"]),
              "SCOPE": SCOPE, "RECOMMENDATION": result["recommendation"], "RUN_URL": result["run_url"],
              "PIPELINE_SECONDS": result["pipeline_seconds_until_report"] if result["pipeline_seconds_until_report"] is not None else "N/D",
              "SUITES_HTML": suite_rows, "FAILURES_HTML": list_html(failures or ["Nenhum caso reprovado registrado; conferir completude da execução."]),
              "RISKS_HTML": list_html(risks),
              "COVERAGE_HTML": list_html([f"{k}: {pct(coverage.get(k))}" for k in ("lines", "branches", "functions", "statements")])}
    for suite in suites:
        write_junit(suite, root / suite["name"] / "normalized.xml")
    output = root / "quality"
    output.mkdir(exist_ok=True)
    artifacts = [p for p in root.rglob("*") if p.is_file() and "quality" not in p.relative_to(root).parts]
    values["ARTIFACTS_HTML"] = "".join(f'<li><a href="../{html.escape(p.relative_to(root).as_posix(), quote=True)}">{html.escape(p.relative_to(root).as_posix())}</a></li>' for p in sorted(artifacts))
    for name in ("technical", "business"):
        template = (ROOT / f".github/quality/{name}.html").read_text(encoding="utf-8")
        (output / f"{name}.html").write_text(redact(render(template, values)), encoding="utf-8")
    (output / "metrics.json").write_text(redact(json.dumps(result, ensure_ascii=False, indent=2)), encoding="utf-8")
    summary = (f"## Qualidade: {result['status']}\n\n"
               f"Executados: {result['executed']} | Aprovados: {result['counts']['passed']} | "
               f"Falhos: {result['counts']['failed']} | Ignorados: {result['counts']['skipped']}\n\n"
               f"Taxa de aprovação dos casos disponíveis: {pct(result['success_rate'])}. "
               f"Coleta {'parcial' if result['partial'] else 'completa'}.\n\n"
               "Baixe o artefato qualidade para abrir quality/technical.html e quality/business.html.\n")
    (output / "summary.md").write_text(summary, encoding="utf-8")
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write(summary)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT / "test-results")
    parser.add_argument("--expected", default="mobile,api,e2e")
    args = parser.parse_args()
    report = build(args.root, args.expected.split(","), {
        "mobile": os.getenv("MOBILE_OUTCOME", "skipped"),
        "api": os.getenv("API_OUTCOME", "skipped"),
        "e2e": os.getenv("E2E_OUTCOME", "skipped")}, os.getenv("PRE_REPORT_STATUS", "success"))
    # Missing results must not silently turn a broken collection into a green job.
    raise SystemExit(1 if report["partial"] or report["counts"]["failed"] else 0)
