const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

const featureSearch = document.querySelector('[data-feature-search]');
const featureCards = [...document.querySelectorAll('[data-feature]')];
const featureCount = document.querySelector('[data-feature-count]');
const featureEmpty = document.querySelector('[data-feature-empty]');

function filterFeatures() {
  const query = normalize(featureSearch.value.trim());
  let visible = 0;
  for (const card of featureCards) {
    card.hidden = !normalize(card.textContent).includes(query);
    if (!card.hidden) visible += 1;
  }
  featureCount.textContent = `Mostrando ${visible} de ${featureCards.length} partes do aplicativo.`;
  featureEmpty.hidden = visible !== 0;
}

if (featureSearch) {
  featureSearch.addEventListener('input', filterFeatures);
  document.querySelector('[data-clear-features]').addEventListener('click', () => {
    featureSearch.value = '';
    filterFeatures();
    featureSearch.focus();
  });
  filterFeatures();
}

const caseButtons = [...document.querySelectorAll('[data-case-filter]')];
const androidCases = [...document.querySelectorAll('[data-case-status]')];
const caseCount = document.querySelector('[data-case-count]');
const caseEmpty = document.querySelector('[data-case-empty]');

for (const button of caseButtons) {
  const status = button.dataset.caseFilter;
  const total = androidCases.filter((item) => status === 'all' || item.dataset.caseStatus === status).length;
  button.querySelector('[data-filter-total]').textContent = String(total);
  button.addEventListener('click', () => {
    let visible = 0;
    for (const item of androidCases) {
      item.hidden = status !== 'all' && item.dataset.caseStatus !== status;
      if (!item.hidden) visible += 1;
    }
    for (const option of caseButtons) option.setAttribute('aria-pressed', String(option === button));
    caseCount.textContent = `Mostrando ${visible} de ${androidCases.length} roteiros Android. O resultado geral não muda com o filtro.`;
    caseEmpty.hidden = visible !== 0;
  });
}

if (caseCount) caseCount.textContent = `Mostrando todos os ${androidCases.length} roteiros Android.`;

for (const button of document.querySelectorAll('[data-details-action]')) {
  button.addEventListener('click', () => {
    const open = button.dataset.detailsAction === 'open';
    for (const detail of document.querySelectorAll('details')) detail.open = open;
    document.querySelector('[data-reading-status]').textContent = open ? 'Abri todas as explicações.' : 'Recolhi todas as explicações.';
  });
}

for (const control of document.querySelectorAll('[data-js-only]')) control.hidden = false;
