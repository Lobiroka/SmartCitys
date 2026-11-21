var occurrenceId = output.e1OccurrenceId;
if (!Number.isInteger(occurrenceId) || occurrenceId < 1) {
    throw new Error('E1: registro desta execução não identificado.');
}
var statusResponse = http.request(MAESTRO_E2E_API_URL.replace(/\/$/, '') +
    '/demands/gestor/' + occurrenceId + '/status', {
    method: 'PATCH',
    headers: {
        Authorization: 'Bearer ' + MAESTRO_E2E_GESTOR_TOKEN,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'EM_ANALISE' }),
});
if (statusResponse.status !== 200) {
    throw new Error('E1: alteração de status falhou (HTTP ' + statusResponse.status + ').');
}
var updated = json(statusResponse.body).denuncia;
if (!updated || updated.id_denuncia !== occurrenceId || updated.status !== 'EM_ANALISE') {
    throw new Error('E1: a API não confirmou o novo status da mesma ocorrência.');
}
