var matches = [];
var page = 1;
var totalPages = 1;
do {
    var response = http.get(MAESTRO_E2E_API_URL.replace(/\/$/, '') +
        '/demands/gestor?limit=100&page=' + page, {
        headers: { Authorization: 'Bearer ' + MAESTRO_E2E_GESTOR_TOKEN },
    });
    if (response.status !== 200) {
        throw new Error('E1: falha ao localizar ocorrência (HTTP ' + response.status + ').');
    }
    var result = json(response.body);
    if (!Array.isArray(result.data) || !result.pagination ||
        !Number.isInteger(result.pagination.totalPages) || result.pagination.totalPages < 1) {
        throw new Error('E1: contrato de paginação inválido.');
    }
    matches = matches.concat(result.data.filter(function (item) {
        return item.titulo === MAESTRO_E2E_TITLE;
    }));
    totalPages = result.pagination.totalPages;
    if (totalPages > 20) {
        throw new Error('E1: use um ambiente de testes dedicado, com até 2000 ocorrências.');
    }
    page += 1;
} while (page <= totalPages);
if (matches.length !== 1 || matches[0].status !== 'ABERTA' ||
    !Number.isInteger(matches[0].id_denuncia) || matches[0].id_denuncia < 1) {
    throw new Error('E1: esperada exatamente uma ocorrência nova e aberta para o título da execução.');
}
output.e1OccurrenceId = matches[0].id_denuncia;
