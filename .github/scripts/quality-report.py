"""Normaliza Jest/Vitest/JUnit e gera indicadores e HTML, sem pacotes externos."""
import argparse
import html
import hashlib
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
ASSESSMENTS = ROOT / '.github/quality/failure-assessments.json'
CAUSES = {
    'sut': 'Defeito do SUT',
    'automation': 'Defeito da TAS',
    'environment': 'Problema de ambiente',
    'expected-change': 'Variação esperada aprovada',
    'pending': 'Triagem pendente',
}


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
        recommendation = "Investigar as falhas e corrigir sua causa antes de aprovar a entrega."
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


def load_assessments(path):
    try:
        entries = load_json(path)
        if not isinstance(entries, list):
            raise ValueError('Formato inválido')
        indexed = {}
        for entry in entries:
            required = ('suite', 'test', 'failure_sha256', 'cause', 'diagnosis', 'evidence', 'reviewer', 'residual_risk')
            if not isinstance(entry, dict) or any(not isinstance(entry.get(key), str) or not entry[key].strip() for key in required):
                raise ValueError('Parecer incompleto')
            if entry['cause'] not in CAUSES or entry['cause'] == 'pending':
                raise ValueError('Causa inválida')
            if entry['suite'] not in ('mobile', 'api', 'e2e'):
                raise ValueError('Suíte inválida')
            if not re.fullmatch(r'[a-f0-9]{64}', entry['failure_sha256']) or not re.match(r'https://[^/\s]+/', entry['evidence']):
                raise ValueError('Evidência inválida')
            key = (entry['suite'], entry['test'], entry['failure_sha256'])
            if key in indexed:
                raise ValueError('Parecer conflitante')
            indexed[key] = entry
        return indexed, []
    except (OSError, ValueError, TypeError):
        return {}, ['Não apliquei os pareceres: arquivo ausente ou inválido. Mantive as falhas como triagem pendente.']


def interpret(result, suites, assessments_path, risks):
    assessments, problems = load_assessments(assessments_path)
    failures = []
    for suite in suites:
        for case in suite['cases']:
            if case['status'] != 'failed':
                continue
            fingerprint = hashlib.sha256(case['message'].encode('utf-8')).hexdigest()
            assessment = assessments.get((suite['name'], case['name'], fingerprint))
            failures.append({
                'suite': suite['name'], 'test': case['name'], 'failure_sha256': fingerprint,
                'cause': assessment['cause'] if assessment else 'pending',
                'diagnosis': assessment['diagnosis'] if assessment else
                    'Causa não confirmada. Investigar SUT, automação, ambiente e requisito antes de classificar.',
                'evidence': assessment['evidence'] if assessment else '',
                'reviewer': assessment['reviewer'] if assessment else 'Não registrado',
                'residual_risk': assessment['residual_risk'] if assessment else
                    'O comportamento validado por este teste permanece sem aprovação; a causa da falha ainda é desconhecida.',
            })
    if result['executed']:
        approval = (f"Observei {result['counts']['passed']} aprovações em {result['executed']} casos executados "
                    f"({result['success_rate']:.2f}%). A razão mede o resultado dos casos disponíveis nesta tentativa; "
                    'não mede a probabilidade de o produto estar livre de defeitos nem sua estabilidade histórica.')
    else:
        approval = 'Não obtive casos executados para calcular a razão de aprovação: N/D. Não considero ausência de execução como aprovação.'
    if result['partial']:
        approval += ' Interpreto essa leitura como parcial, pois a preparação, execução ou coleta não foi concluída.'
    if result['counts']['skipped']:
        approval += f" Excluí {result['counts']['skipped']} casos ignorados do denominador; eles não validaram o produto."
    if result['counts']['failed']:
        approval += ' Mantenho a entrega sem aprovação enquanto as falhas forem investigadas e sua causa for corrigida, mesmo com taxa alta.'
    sut_count = sum(failure['cause'] == 'sut' for failure in failures)
    pending_count = sum(failure['cause'] == 'pending' for failure in failures)
    fault_interpretation = (f'Identifiquei {sut_count} falhas classificadas como defeito do SUT por parecer com evidência '
                            f'e {pending_count} falhas com triagem pendente. A classificação registra o diagnóstico humano; '
                            'o coletor não confirma a causa pelo nome do teste ou pela mensagem de erro.')
    if not failures:
        fault_interpretation = ('Não encontrei casos reprovados nos resultados disponíveis. '
                                'Essa ausência não comprova ausência de defeitos nas jornadas fora do escopo ou não executadas.')
    risks.extend(problems)
    if pending_count:
        risks.append(f'Mantenho {pending_count} falhas sem causa confirmada; a investigação pode revelar defeitos do produto, da TAS ou do ambiente.')
    for failure in failures:
        risks.append(f"{failure['suite']} / {failure['test']}: {failure['residual_risk']}")
    for suite in suites:
        for case in suite['cases']:
            if case['status'] == 'skipped':
                risks.append(f"Não validei {suite['name']} / {case['name']}: caso ignorado nesta execução; mantenho a jornada sem evidência desse teste.")
    incomplete = [suite['name'] for suite in suites if not suite['complete']]
    if incomplete:
        risks.append('Não obtive validação completa das suítes: ' + ', '.join(incomplete) + '. Não atribuo falhas de coleta ao SUT sem investigação.')
    risks.append('Mantenho risco residual nas jornadas não exercitadas, no código fora da cobertura instrumentada e no ambiente de destino; uma execução aprovada não elimina esses riscos.')
    return {'approval_interpretation': approval, 'fault_interpretation': fault_interpretation,
            'failure_assessments': failures, 'sut_failures': sut_count,
            'pending_failures': pending_count, 'assessment_problems': problems, 'residual_risks': risks}


def markdown_text(value):
    return re.sub(r'([\\`*_{}\[\]()#+!|>])', r'\\\1', html.escape(str(value)).replace('\n', ' '))


def display_duration(seconds):
    if seconds is None or not math.isfinite(seconds) or seconds < 0:
        return 'Não informada'
    if seconds < 1:
        return 'Menos de 1 s'
    minutes, remaining = divmod(round(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    parts = ([f'{hours} h'] if hours else []) + ([f'{minutes} min'] if minutes else [])
    return ' '.join(parts + ([f'{remaining} s'] if remaining or not parts else []))


def html_presentation(result):
    labels = {'mobile': 'Aplicativo', 'api': 'Serviços do sistema', 'e2e': 'Fluxos completos no Android'}
    states = {
        'VERDE': ('passed', 'Sem pendências nos critérios medidos', 'Os testes desta execução passaram.'),
        'AMARELO': ('attention', 'Precisa de atenção', 'Os testes passaram, mas ainda há pontos a verificar.'),
        'VERMELHO': ('failed', 'Há falhas a investigar', 'Encontrei testes que não passaram.'),
        'INCONCLUSIVO': ('incomplete', 'Resultado incompleto', 'Ainda não tenho informação suficiente para concluir.'),
    }
    state, label, headline = states[result['status']]
    counts = result['counts']
    pct = lambda value: 'Não calculada' if value is None else f'{value:.2f}%'.replace('.', ',')
    quantity = lambda count, singular, plural: f'{count} {singular if count == 1 else plural}'
    list_html = lambda items: ''.join(f'<li>{html.escape(item)}</li>' for item in items)
    approval = (f"Observei {quantity(counts['passed'], 'aprovação', 'aprovações')} entre "
                f"{quantity(result['executed'], 'teste executado', 'testes executados')}. "
                f"Também registrei {quantity(counts['failed'], 'falha', 'falhas')} e "
                f"{quantity(counts['skipped'], 'teste não executado', 'testes não executados')}.")
    meaning = (f"A aprovação de {pct(result['success_rate'])} considera apenas os testes que chegaram a um resultado: "
               f"{quantity(counts['passed'], 'aprovação', 'aprovações')} entre "
               f"{quantity(result['executed'], 'teste executado', 'testes executados')}.") if result['executed'] else (
               'Não calculei a aprovação porque não há testes executados com resultado disponível.')
    if result['partial']:
        approval += ' A preparação, a execução ou o recebimento dos resultados ficou incompleto.'
        meaning += ' Essa leitura é parcial: resultados ausentes podem mudar a conclusão.'
    coverage_labels = {'lines': 'Linhas de código', 'branches': 'Decisões do código',
                       'functions': 'Funções', 'statements': 'Instruções'}
    reasons, actions = [], []
    if counts['failed']:
        reasons.append(f"Registrei {quantity(counts['failed'], 'teste com falha', 'testes com falha')}; "
                       'uma única falha já determina o resultado vermelho, mesmo que a aprovação seja alta.')
        actions.append('Investigar as falhas, registrar se a causa está no produto, nos testes ou no ambiente e validar a correção.')
    if result['partial']:
        reasons.append('A preparação, a execução ou a leitura dos resultados ficou incompleta. '
                       'Sem uma falha registrada, essa situação determina o resultado inconclusivo.')
        actions.append('Conferir quais etapas ou resultados ficaram incompletos, resolver a causa e repetir a execução.')
    if not result['executed']:
        reasons.append('Não há testes executados com resultado disponível para calcular a aprovação.')
    if counts['skipped']:
        reasons.append(f"Registrei {quantity(counts['skipped'], 'teste não executado', 'testes não executados')}. "
                       'Esses testes não confirmaram os comportamentos que deveriam verificar.')
        actions.append('Revisar o motivo de cada teste não executado e validar os comportamentos que ficaram pendentes.')
    if result['coverage_problem']:
        reasons.append('Não recebi a medição de cobertura do código; por isso não considero a meta de cobertura atendida.')
        actions.append('Restabelecer a medição de cobertura antes de concluir quanto do código foi exercitado.')
    else:
        below_target = [f'{coverage_labels[key]}: {pct(value)}'
                        for key, value in result['coverage'].items() if value < 70]
        if below_target:
            reasons.append('A cobertura ficou abaixo da referência de 70% nos indicadores: ' + ', '.join(below_target) + '.')
            actions.append('Revisar o código menos exercitado e complementar os testes dos comportamentos relevantes.')
    if result['status'] == 'AMARELO':
        reasons.insert(0, 'Os testes executados passaram e recebi os resultados esperados, '
                       'mas as pendências abaixo impedem a classificação verde.')
    if result['status'] == 'VERDE':
        reasons.append('Recebi os resultados esperados, houve testes executados, nenhum falhou ou ficou ignorado '
                       'e os quatro indicadores de cobertura atingiram pelo menos 70%.')
    actions.append('Complementar os testes automatizados com a avaliação de uso do aplicativo e do ambiente em que ele será utilizado.')
    next_steps = {
        'VERDE': 'Recomendo complementar estes resultados com a avaliação de uso e a conferência do ambiente de destino.',
        'AMARELO': 'Recomendo revisar as pendências abaixo antes de decidir pela entrega.',
        'VERMELHO': 'Recomendo investigar cada falha, corrigir sua causa e repetir a validação antes de aprovar a entrega.',
        'INCONCLUSIVO': 'Recomendo resolver o que impediu a validação completa e executar os testes novamente.',
    }
    risks = []
    if counts['failed']:
        risks.append(f"Há {quantity(counts['failed'], 'teste com falha', 'testes com falha')}. Uma taxa alta de aprovação não compensa esses problemas.")
    if result['pending_failures']:
        risks.append(f"Ainda preciso confirmar a causa de {quantity(result['pending_failures'], 'falha', 'falhas')}: pode estar no aplicativo, nos testes ou no ambiente.")
    if result['partial']:
        risks.append('Faltam resultados confiáveis de parte da execução; não considero essa ausência uma aprovação.')
    if counts['skipped']:
        risks.append(f"Há {quantity(counts['skipped'], 'teste não executado', 'testes não executados')}. Os comportamentos previstos nesses testes continuam sem verificação nesta tentativa.")
    if result['coverage_problem']:
        risks.append('Não recebi a medição de cobertura. Não consigo afirmar quanto do código foi exercitado.')
    elif any(value < 70 for value in result['coverage'].values()):
        risks.append('Parte da cobertura ficou abaixo da referência de 70%; recomendo revisar os trechos menos exercitados.')
    if result['assessment_problems']:
        risks.append('Não consegui aplicar os diagnósticos registrados; as causas das falhas permanecem sem confirmação.')
    risks.append('Os comportamentos fora dos testes e o funcionamento do ambiente publicado ainda precisam de avaliação própria.')
    if not counts['failed']:
        fault = ('Não encontrei testes reprovados nos resultados disponíveis. Isso não garante ausência de problemas '
                 'nas partes que não foram verificadas.')
    else:
        fault = (f"Identifiquei {quantity(result['sut_failures'], 'falha classificada', 'falhas classificadas')} "
                 f"como defeito do aplicativo ou de seus serviços e "
                 f"{quantity(result['pending_failures'], 'falha', 'falhas')} com causa ainda em investigação. "
                 'Só apresento uma causa como identificada quando há um diagnóstico registrado com evidência e revisor.')
    causes = {'sut': 'Defeito do aplicativo ou de seus serviços', 'automation': 'Problema na automação dos testes',
              'environment': 'Problema no ambiente de testes', 'expected-change': 'Mudança esperada e aprovada',
              'pending': 'Causa ainda em investigação'}
    assessments = []
    for failure in result['failure_assessments']:
        evidence = (f'<a href="{html.escape(failure["evidence"], quote=True)}">Consultar evidência da análise</a>'
                    if failure['evidence'] else 'Evidência ainda não registrada.')
        diagnosis = failure['diagnosis'] if failure['cause'] != 'pending' else (
            'Ainda preciso investigar se a falha está no produto, no roteiro do teste, no ambiente ou em uma mudança de requisito.')
        assessments.append(
            '<article class="assessment">'
            f'<h3>{html.escape(labels.get(failure["suite"], failure["suite"]))}: {html.escape(failure["test"])}</h3>'
            f'<p><strong>{causes[failure["cause"]]}</strong></p>'
            f'<p>{html.escape(diagnosis)}</p>'
            f'<p><strong>O que ainda preocupa:</strong> {html.escape(failure["residual_risk"])}</p>'
            f'<p class="muted">Revisor registrado: {html.escape(failure["reviewer"])}. {evidence}</p></article>')
    skipped = [f'{labels.get(suite["name"], suite["name"])}: {case["name"]}'
               for suite in result['suites'] for case in suite['cases'] if case['status'] == 'skipped']
    rows = ''.join(
        f'<tr><th scope="row">{html.escape(labels.get(suite["name"], suite["name"]))}</th>'
        f'<td>{suite["counts"]["passed"]}</td><td>{suite["counts"]["failed"]}</td>'
        f'<td>{suite["counts"]["skipped"]}</td><td>{display_duration(suite["duration_seconds"])}</td>'
        f'<td>{"Completos" if suite["complete"] else "Incompletos"}</td></tr>' for suite in result['suites'])
    area_descriptions = {
        'mobile': 'São as telas e regras do Smart City: por exemplo, o formulário Nova ocorrência e a lista da aba Ocorrências. Verifico partes isoladas do código; isso não comprova, por si só, a integração com os serviços.',
        'api': 'São os bastidores do Smart City que recebem e salvam ocorrências e conferem permissões. Verifico requisições e respostas; esses testes não percorrem a tela do Android.',
        'e2e': 'É o uso do Smart City no Android integrado aos serviços, como entrar e registrar uma ocorrência. Só considero as ações dos roteiros que aparecem nos resultados desta execução.',
    }
    android = next((suite for suite in result['suites'] if suite['name'] == 'e2e'), None)
    case_states = {'passed': ('passed', 'Passou'), 'failed': ('failed', 'Falhou'),
                   'skipped': ('attention', 'Não executado')}
    android_cases = []
    for case in android['cases'] if android else []:
        css_class, case_label = case_states[case['status']]
        android_cases.append(f'<li data-case-status="{case["status"]}"><span class="case-result {css_class}">{case_label}</span> '
                             f'<span>{html.escape(case["name"])}</span></li>')
    android_filters = (
        '<div class="case-tools" data-js-only hidden>'
        '<div class="filter-buttons" role="group" aria-label="Filtrar roteiros Android por resultado">' +
        ''.join(f'<button type="button" data-case-filter="{status}" aria-controls="android-cases" '
                f'aria-pressed="{"true" if status == "all" else "false"}">{label} '
                '<span data-filter-total></span></button>'
                for status, label in (('all', 'Todos'), ('passed', 'Passaram'), ('failed', 'Falharam'),
                                      ('skipped', 'Não executados'))) +
        '</div><p class="filter-count" data-case-count role="status"></p></div>')
    no_android = ('Não recebi resultados de roteiros completos no Android. Não consigo confirmar esses fluxos nesta execução.'
                  if android else 'Esta rotina não incluiu roteiros completos no Android. Os resultados das outras áreas não substituem essa verificação.')
    return {
        'REPORT_STYLES_HTML': (ROOT / '.github/quality/report.css').read_text(encoding='utf-8'),
        'REPORT_SCRIPT_HTML': (ROOT / '.github/quality/report.js').read_text(encoding='utf-8'),
        'APP_CONTEXT_HTML': (ROOT / '.github/quality/app-context.html').read_text(encoding='utf-8'),
        'ANDROID_CASES_HTML': android_filters + '<ul class="android-cases" id="android-cases">' +
                              ''.join(android_cases) + '</ul>' +
                              '<p class="empty-state" data-case-empty hidden>Nenhum roteiro corresponde a este filtro.</p>'
                              if android_cases else f'<p>{no_android}</p>',
        'STATUS_CLASS': state, 'STATUS_LABEL': label, 'RESULT_HEADLINE': headline,
        'APPROVAL_EXPLANATION': approval, 'APPROVAL_RATE': pct(result['success_rate']),
        'RATE_MEANING': meaning, 'NEXT_STEP': next_steps[result['status']], 'FAULT_EXPLANATION': fault,
        'MAIN_RISKS_HTML': list_html(risks), 'SUITES_HTML': rows,
        'STATUS_REASONS_HTML': list_html(reasons), 'NEXT_STEPS_HTML': list_html(actions),
        'AREAS_HTML': ''.join(f'<li><strong>{html.escape(labels.get(suite["name"], suite["name"]))}:</strong> '
                              f'{html.escape(area_descriptions.get(suite["name"], "Consultar os resultados desta área."))}</li>'
                              for suite in result['suites']),
        'ASSESSMENTS_HTML': ''.join(assessments) or '<p>Não há testes reprovados para detalhar nos resultados disponíveis.</p>',
        'SKIPPED_HTML': list_html(skipped or ['Nenhum teste foi registrado como não executado. Confira também se os resultados estão completos.']),
        'COVERAGE_HTML': list_html([f'{label}: {pct(result["coverage"].get(key)) if key in result["coverage"] else "Não medida"}'
                                    for key, label in coverage_labels.items()]),
        'TEST_SCOPE': 'Esta execução reúne testes das seguintes áreas: ' +
                      ', '.join(labels.get(suite['name'], suite['name']) for suite in result['suites']) + '.',
        'READABLE_DURATION': display_duration(result['pipeline_seconds_until_report']),
        'READABLE_DATE': datetime.fromisoformat(result['date']).strftime('%d/%m/%Y às %H:%M UTC'),
    }


def build(root, expected, outcomes, job_status="success", assessments_path=ASSESSMENTS):
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
    result.update(interpret(result, suites, assessments_path, risks))
    list_html = lambda items: "".join(f"<li>{html.escape(str(item))}</li>" for item in items)
    failures = [f"{x['name']}: {c['name']} — {c['message']}" for x in suites for c in x["cases"] if c["status"] == "failed"]
    failures += [f"{x['name']}: {p}" for x in suites for p in x["problems"]]
    pct = lambda value: "N/D" if value is None else f"{value:.2f}%"
    values = {"WORKFLOW": result["workflow"], "RUN": result["run"], "ATTEMPT": result["attempt"],
              "COMMIT": result["commit"], "DATE": result["date"], "STATUS": result["status"],
              "EXECUTED": result["executed"], "PASSED": result["counts"]["passed"],
              "FAILED": result["counts"]["failed"], "SKIPPED": result["counts"]["skipped"],
              "SUCCESS_RATE": pct(result["success_rate"]), "FAILURE_RATE": pct(result["failure_rate"]),
              "SCOPE": SCOPE, "RECOMMENDATION": result["recommendation"], "RUN_URL": result["run_url"],
              "FAILURES_HTML": list_html(failures or ["Não há testes reprovados nos resultados disponíveis. Confira também se a execução foi completa."]),
              "RISKS_HTML": list_html(risks),
              "APPROVAL_INTERPRETATION": result['approval_interpretation']}
    values.update(html_presentation(result))
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
               "### Interpretação dos números\n\n" + markdown_text(result['approval_interpretation']) + "\n\n"
               "### Diagnóstico das falhas\n\n" + markdown_text(result['fault_interpretation']) + "\n\n" +
               '\n'.join('- ' + markdown_text(
                   f"{failure['suite']} / {failure['test']}: {CAUSES[failure['cause']]}. "
                   f"{failure['diagnosis']} Parecer: {failure['reviewer']}. Evidência: {failure['evidence'] or 'pendente'}. "
                   f"Risco residual: {failure['residual_risk']}") for failure in result['failure_assessments']) +
               "\n\n### Riscos residuais\n\n" + '\n'.join('- ' + markdown_text(risk) for risk in risks) + "\n\n"
               "Baixe o artefato qualidade para abrir quality/technical.html e quality/business.html.\n")
    summary = redact(summary)
    (output / "summary.md").write_text(summary, encoding="utf-8")
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write(summary)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT / "test-results")
    parser.add_argument("--expected", default="mobile,api,e2e")
    parser.add_argument("--assessments", type=Path, default=ASSESSMENTS)
    args = parser.parse_args()
    report = build(args.root, args.expected.split(","), {
        "mobile": os.getenv("MOBILE_OUTCOME", "skipped"),
        "api": os.getenv("API_OUTCOME", "skipped"),
        "e2e": os.getenv("E2E_OUTCOME", "skipped")}, os.getenv("PRE_REPORT_STATUS", "success"), args.assessments)
    # Missing results must not silently turn a broken collection into a green job.
    raise SystemExit(1 if report["partial"] or report["counts"]["failed"] else 0)
