var apiUrl = MAESTRO_E2E_API_URL.replace(/\/$/, '');
var managerHeaders = {
    Authorization: 'Bearer ' + MAESTRO_E2E_GESTOR_TOKEN,
    'Content-Type': 'application/json',
};
var managerResponse = http.get(apiUrl + '/demands/gestor?limit=1', {
    headers: managerHeaders,
});
if (managerResponse.status !== 200) {
    throw new Error('E1: API de gestor indisponível ou sem autorização (HTTP ' + managerResponse.status + ').');
}
