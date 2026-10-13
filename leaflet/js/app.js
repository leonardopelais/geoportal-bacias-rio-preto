/* Geoportal – Bacias que abastecem Rio Preto
   Leaflet puro, sem build. Dados em /data (GeoJSON). */
'use strict';

// ---------- constantes ----------
const GRUPOS = [
  { k: 'Vegetação nativa', cor: '#1f8d49' },
  { k: 'Mosaico de usos', cor: '#ffefc3' },
  { k: 'Pastagem', cor: '#edde8e' },
  { k: 'Cana-de-açúcar', cor: '#db7093' },
  { k: 'Outras lavouras', cor: '#b05fc0' },
  { k: 'Silvicultura', cor: '#7a5900' },
  { k: 'Área urbanizada', cor: '#d4271e' },
  { k: 'Água', cor: '#2532e4' },
  { k: 'Outros', cor: '#9aa5ad' },
];
const COR = Object.fromEntries(GRUPOS.map(g => [g.k, g.cor]));
const LEGENDA_IDS = [20, 21, 15, 3, 24, 33, 39, 47, 11, 46, 9];
const IQA_CLASSES = [
  { nome: 'Ótima', min: 79, cor: '#1f6fd1' },
  { nome: 'Boa', min: 51, cor: '#2e9e4f' },
  { nome: 'Regular', min: 36, cor: '#e6b800' },
  { nome: 'Ruim', min: 19, cor: '#d93a2b' },
  { nome: 'Péssima', min: -1, cor: '#6b2b8f' },
];
const SEM_DADO = '#9aa5ad';
const PARAMS = {
  IQA: { nome: 'IQA', un: '', dec: 0 },
  OD: { nome: 'Oxigênio dissolvido', un: 'mg/L', dec: 1 },
  DBO: { nome: 'DBO', un: 'mg/L', dec: 1 },
  E_coli: { nome: 'E. coli', un: 'NMP/100 mL', dec: 0 },
  P_total: { nome: 'Fósforo total', un: 'mg/L', dec: 3 },
  Turbidez: { nome: 'Turbidez', un: 'UT', dec: 1 },
};
const CORRELACOES = [
  ['Área urbana × E. coli', 0.68, 0.010],
  ['Vegetação nativa × E. coli', -0.70, 0.007],
  ['Veg. nativa em APP × IQA', 0.58, 0.039],
  ['Cana × fósforo total', 0.06, 0.845],
  ['Cana × turbidez', 0.07, 0.817],
  ['Cana × IQA', -0.05, 0.859],
];
const nf = Charts.nf;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

function iqaClasse(v) {
  if (v == null) return null;
  return IQA_CLASSES.find(c => v > c.min) || IQA_CLASSES[IQA_CLASSES.length - 1];
}

// ---------- mapa ----------
const map = L.map('map', { zoomControl: false, minZoom: 7, maxZoom: 18, zoomSnap: 0.25, attributionControl: true });
L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

map.createPane('raster'); map.getPane('raster').style.zIndex = 250;
const cv = L.canvas({ padding: 0.4 });          // um único canvas: eventos e ordem de desenho corretos

const BASES = {
  sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics' }),
  osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }),
  light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap contributors © CARTO' }),
};
let baseAtual = 'sat';
BASES.sat.addTo(map);

const state = { ano: '2024', basinSel: null, stationSel: null, data: {}, meta: null };
const L_ = {};      // camadas
let raster = null;

const J = f => fetch('data/' + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });

Promise.all([
  J('bacias_nivel5.geojson'), J('bacias_nivel6.geojson'), J('municipios.geojson'), J('limite_sjrp.geojson'),
  J('rios.geojson'), J('rios_rotulos.geojson'), J('estacoes.geojson'), J('bacias_estacoes.geojson'),
  J('etes.geojson'), J('captacoes.geojson'), J('raster_meta.json'),
]).then(([n5, n6, mun, sjrp, rios, rotulos, est, bcs, etes, caps, meta]) => {
  Object.assign(state.data, { n5, n6, mun, sjrp, rios, rotulos, est, bcs, etes, caps });
  state.meta = meta;
  construir();
}).catch(e => { console.error(e); toast('Não foi possível carregar os dados: ' + e.message, 8000); });

// ---------- camadas ----------
function estiloN5(sel) {
  const claro = baseAtual !== 'sat';
  return { renderer: cv, color: claro ? '#1c2630' : '#ffffff', weight: sel ? 4 : 2.5, fillColor: '#ffffff', fillOpacity: sel ? 0.12 : 0, interactive: true };
}

function construir() {
  const d = state.data;
  raster = L.imageOverlay(`img/uso_${state.ano}.png`, state.meta.bounds, { pane: 'raster', opacity: 0.8, alt: 'Uso do solo MapBiomas' }).addTo(map);

  L_.mun = L.geoJSON(d.mun, { renderer: cv, interactive: false, style: { color: '#f2f2f2', weight: 1, dashArray: '5 4', fill: false, opacity: .9 } });
  L_.n6 = L.geoJSON(d.n6, { renderer: cv, interactive: false, style: { color: '#ffffff', weight: 1, opacity: .55, fill: false } });
  L_.n5 = L.geoJSON(d.n5, {
    style: () => estiloN5(false),
    onEachFeature: (f, l) => {
      l.bindTooltip(esc(f.properties.nome), { sticky: true });
      l.on('mouseover', () => { if (state.basinSel !== l) l.setStyle({ weight: 3.5, fillOpacity: 0.08 }); });
      l.on('mouseout', () => { if (state.basinSel !== l) l.setStyle(estiloN5(false)); });
      l.on('click', () => selecionarBacia(l, f));
    },
  });
  L_.rios = L.geoJSON(d.rios, { renderer: cv, interactive: false, style: { color: '#3db8ff', weight: 1.6, opacity: .9 } });
  L_.riosRot = L.geoJSON(d.rotulos, {
    renderer: cv, interactive: false, style: { color: '#3db8ff', weight: 3, opacity: .95 },
    onEachFeature: (f, l) => l.bindTooltip(esc(f.properties.nome), { permanent: true, direction: 'center', className: 'river-label' }),
  });
  L_.rioGrupo = L.layerGroup([L_.rios, L_.riosRot]);
  L_.sjrp = L.geoJSON(d.sjrp, { renderer: cv, interactive: false, style: { color: '#ff3b30', weight: 3, fill: false } });
  L_.bc = L.geoJSON(null, { renderer: cv, interactive: false, style: { color: '#00e5ff', weight: 2.5, dashArray: '7 5', fillColor: '#00e5ff', fillOpacity: 0.12 } });

  const popupCap = (p) => `<b>${esc(p.fin)}</b><table>
    <tr><td>Tipo</td><td>${esc(p.tipo)}</td></tr>
    ${p.mun ? `<tr><td>Município</td><td>${esc(p.mun)}</td></tr>` : ''}
    ${p.corpo ? `<tr><td>Corpo hídrico</td><td>${esc(p.corpo)}</td></tr>` : ''}
    ${p.vazao != null ? `<tr><td>Vazão outorgada</td><td>${nf(p.vazao * 1000, 1)} L/s</td></tr>` : ''}
    ${p.val ? `<tr><td>Validade</td><td>${p.val.split('-').reverse().join('/')}</td></tr>` : ''}</table>`;
  const capLayer = (tipo, estilo) => L.geoJSON(d.caps, {
    renderer: cv, filter: f => f.properties.tipo === tipo,
    pointToLayer: (f, ll) => L.circleMarker(ll, estilo),
    onEachFeature: (f, l) => l.bindPopup(popupCap(f.properties)),
  });
  L_.capSub = capLayer('Subterrâneo', { renderer: cv, radius: 3, color: '#ffffff', weight: .6, fillColor: '#6b7780', fillOpacity: .9 });
  L_.capSup = capLayer('Superficial', { renderer: cv, radius: 6, color: '#ffffff', weight: 1.5, fillColor: '#7b3fa0', fillOpacity: 1 });

  L_.etes = L.geoJSON(d.etes, {
    renderer: cv,
    pointToLayer: (f, ll) => L.circleMarker(ll, { renderer: cv, radius: 6, color: '#ffffff', weight: 1.5, fillColor: '#e07b00', fillOpacity: 1 }),
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindPopup(`<b>${esc(p.nome)}</b><table>
        <tr><td>Situação</td><td>${esc(p.status)}</td></tr>
        <tr><td>Tipologia</td><td>${esc(p.tipo)}</td></tr>
        ${p.corpo ? `<tr><td>Corpo receptor</td><td>${esc(p.corpo)}</td></tr>` : ''}
        ${p.rem_dbo ? `<tr><td>Remoção de DBO (projeto)</td><td>${p.rem_dbo}%</td></tr>` : ''}</table>`);
    },
  });

  L_.est = L.geoJSON(d.est, {
    renderer: cv,
    pointToLayer: (f, ll) => {
      const c = f.properties.med ? iqaClasse(f.properties.med.IQA).cor : SEM_DADO;
      return L.circleMarker(ll, { renderer: cv, radius: 9, color: '#ffffff', weight: 2.5, fillColor: c, fillOpacity: 1 });
    },
    onEachFeature: (f, l) => {
      const p = f.properties;
      const c = p.med ? iqaClasse(p.med.IQA) : null;
      l.bindTooltip(`<b>${esc(p.id)}</b> · ${esc(p.corpo)}<br>${c ? 'IQA ' + nf(p.med.IQA) + ' (' + c.nome + ')' : 'Sem mediana 2018–2021'}`, { direction: 'top', offset: [0, -8] });
      l.on('click', () => selecionarEstacao(f));
    },
  });

  // ordem inicial: de baixo para cima
  [L_.mun, L_.n5, L_.rioGrupo, L_.sjrp, L_.etes, L_.est].forEach(l => l.addTo(map));
  restack();

  montarLegendas(); ligarUI(); montarBusca(); abrirPanorama();
  fitInicial();
}

const ORDEM = () => [L_.n6, L_.mun, L_.n5, L_.bc, L_.rios, L_.riosRot, L_.sjrp, L_.capSub, L_.capSup, L_.etes, L_.est];
function restack() { ORDEM().forEach(l => { if (l && map.hasLayer(l)) l.bringToFront(); }); }

function fitInicial() {
  const b = L_.n5.getBounds();
  const pad = isMobile() ? { paddingTopLeft: [10, 10], paddingBottomRight: [10, window.innerHeight * 0.55] } : { padding: [30, 30] };
  map.fitBounds(b, pad);
}

// ---------- legendas ----------
function montarLegendas() {
  $('#legendList').innerHTML = LEGENDA_IDS.map(id => {
    const c = state.meta.classes.find(x => x.valor === id);
    return c ? `<li><span class="sw" style="background:${c.cor}"></span>${esc(c.nome)}</li>` : '';
  }).join('');
  const FX = {'Ótima':'80–100','Boa':'52–79','Regular':'37–51','Ruim':'20–36','Péssima':'0–19'}; $('#iqaLegend').innerHTML = '<li class="lt"><b>IQA · Índice de Qualidade das Águas</b> (CETESB)<br><small>Cor da estação = classe da mediana 2018–2021. Quanto maior o IQA, melhor a água.</small></li>' + IQA_CLASSES.map(c => `<li><i class="dot" style="background:${c.cor}"></i>${c.nome} <small>(IQA ${FX[c.nome]})</small></li>`).join('') + `<li><i class="dot" style="background:${SEM_DADO}"></i>Sem dado</li>`;
}

// ---------- UI ----------
function ligarUI() {
  $$('input[name=base]').forEach(r => r.addEventListener('change', () => trocarBase(r.value)));
  $$('.seg button').forEach(b => b.addEventListener('click', () => {
    $$('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const a = b.dataset.ano;
    if (a === 'off') { map.removeLayer(raster); return; }
    state.ano = a; raster.setUrl(`img/uso_${a}.png`); if (!map.hasLayer(raster)) raster.addTo(map);
  }));
  $('#op').addEventListener('input', e => raster.setOpacity(+e.target.value));
  const liga = (id, layer) => $('#' + id).addEventListener('change', e => { e.target.checked ? layer.addTo(map) : map.removeLayer(layer); restack(); });
  liga('l-n5', L_.n5); liga('l-n6', L_.n6); liga('l-rios', L_.rioGrupo); liga('l-mun', L_.mun); liga('l-sjrp', L_.sjrp);
  liga('l-est', L_.est); liga('l-ete', L_.etes); liga('l-cap-sup', L_.capSup); liga('l-cap-sub', L_.capSub);
  $$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#sheetHandle').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));
  map.on('click', () => { /* clique no vazio não fecha o painel */ });
}

function trocarBase(k) {
  map.removeLayer(BASES[baseAtual]); BASES[k].addTo(map).bringToBack(); baseAtual = k;
  L_.n5.eachLayer(l => l.setStyle(estiloN5(state.basinSel === l)));
}

function setTab(nome) {
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === nome));
  $$('.tab').forEach(t => { t.hidden = t.id !== 'tab-' + nome; });
  $('#sidebar').scrollTo({ top: 0 });
}
function abrirAnalise() { setTab('analise'); $('#sidebar').classList.remove('collapsed'); }

function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------- análise: panorama ----------
function agregado(recorte, ano) {
  const out = Object.fromEntries(GRUPOS.map(g => [g.k, 0])); let total = 0;
  state.data.n5.features.forEach(f => {
    const p = f.properties, a = recorte === 'uso' ? p.area_km2 : p.app_km2; total += a;
    GRUPOS.forEach(g => { out[g.k] += (p[recorte][ano][g.k] || 0) * a; });
  });
  GRUPOS.forEach(g => { out[g.k] = out[g.k] / total; });
  return { pct: out, area: total };
}
const partes = pct => GRUPOS.map(g => ({ cor: g.cor, valor: pct[g.k] || 0, nome: g.k }));
const chaves = () => `<div class="keys">${GRUPOS.slice(0, 7).map(g => `<span><i style="background:${g.cor}"></i>${g.k}</span>`).join('')}</div>`;
const seta = (a, b) => `${nf(a, 1)}% → ${nf(b, 1)}%`;
function statsUso(u85, u24) {
  const it = [['Cana-de-açúcar', 'Cana'], ['Pastagem', 'Pastagem'], ['Vegetação nativa', 'Veg. nativa'], ['Área urbanizada', 'Área urbana']];
  return `<div class="stats">${it.map(([k, rot]) => `<div class="stat"><b>${seta(u85[k], u24[k])}</b><span>${rot}, 1985 → 2024</span></div>`).join('')}</div>`;
}

function abrirPanorama() {
  deselecionar();
  const a85 = agregado('uso', '1985'), a24 = agregado('uso', '2024'), p85 = agregado('app', '1985'), p24 = agregado('app', '2024');
  const rows = [...state.data.n5.features].sort((a, b) => b.properties.uso['2024']['Cana-de-açúcar'] - a.properties.uso['2024']['Cana-de-açúcar']);
  $('#analise').innerHTML = `
    <p class="kicker">Panorama</p>
    <h2 class="title">7 ottobacias · ${nf(a24.area, 0)} km²</h2>
    <p class="muted">Clique em uma bacia ou em uma estação no mapa para ver os detalhes.</p>
    ${statsUso(a85.pct, a24.pct)}
    <div class="card">
      <h3>Uso do solo na região</h3>
      <div class="bar-label"><span>1985</span></div>${Charts.bar(partes(a85.pct))}
      <div class="bar-label"><span>2024</span></div>${Charts.bar(partes(a24.pct))}
      <div class="bar-label"><span>Faixa de APP (30 m) · 2024: ${nf(p24.pct['Vegetação nativa'], 0)}% de vegetação nativa (1985: ${nf(p85.pct['Vegetação nativa'], 0)}%)</span></div>${Charts.bar(partes(p24.pct))}
      ${chaves()}
    </div>
    <div class="card">
      <h3>Água × uso do solo (13 estações)</h3>
      <table class="mini"><tr><th>Associação (Spearman)</th><th class="n">ρ</th><th class="n">p</th></tr>
      ${CORRELACOES.map(([n, r, p]) => `<tr class="${p < 0.05 ? 'sig' : ''}"><td>${n}</td><td class="n">${nf(r, 2)}</td><td class="n">${nf(p, 3)}</td></tr>`).join('')}</table>
      <p class="muted">Em destaque: p &lt; 0,05. São associações com n = 13, não causalidade. A rede não mede agrotóxicos; a cana sem sinal não é prova de ausência de efeito.</p>
    </div>
    <h3>Bacias (ordenadas pela % de cana em 2024)</h3>
    <ul class="list">${rows.map(f => `<li data-cod="${f.properties.cod}"><span>${esc(f.properties.nome)}</span><span class="muted">${nf(f.properties.uso['2024']['Cana-de-açúcar'], 0)}% cana</span></li>`).join('')}</ul>`;
  $$('#analise .list li').forEach(li => li.addEventListener('click', () => {
    const l = L_.n5.getLayers().find(x => x.feature.properties.cod === li.dataset.cod);
    selecionarBacia(l, l.feature, true);
  }));
}

// ---------- seleção ----------
function deselecionar() {
  if (state.basinSel) { state.basinSel.setStyle(estiloN5(false)); state.basinSel = null; }
  state.stationSel = null; L_.bc.clearLayers(); if (map.hasLayer(L_.bc)) map.removeLayer(L_.bc);
}

function selecionarBacia(layer, f, zoom) {
  deselecionar();
  state.basinSel = layer; layer.setStyle(estiloN5(true)); layer.bringToFront(); restack();
  if (zoom) map.fitBounds(layer.getBounds(), isMobile() ? { paddingBottomRight: [10, window.innerHeight * 0.55] } : { padding: [30, 30] });
  const p = f.properties, e = state.data.est.features.filter(x => x.properties.bacia === p.nome);
  $('#analise').innerHTML = `
    <button class="btn" id="voltar">← Panorama</button>
    <p class="kicker" style="margin-top:12px">Ottobacia nível 5 · cód. ${esc(p.cod)}</p>
    <h2 class="title">${esc(p.nome)}</h2>
    <p class="muted">${nf(p.area_km2, 0)} km² · faixa de APP de 30 m: ${nf(p.app_km2, 0)} km²</p>
    ${statsUso(p.uso['1985'], p.uso['2024'])}
    <div class="card">
      <h3>Bacia inteira</h3>
      <div class="bar-label"><span>1985</span></div>${Charts.bar(partes(p.uso['1985']))}
      <div class="bar-label"><span>2024</span></div>${Charts.bar(partes(p.uso['2024']))}
      <h3 style="margin-top:12px">Somente faixa de APP (30 m dos rios)</h3>
      <div class="bar-label"><span>1985 · ${nf(p.app['1985']['Vegetação nativa'], 0)}% nativa</span></div>${Charts.bar(partes(p.app['1985']))}
      <div class="bar-label"><span>2024 · ${nf(p.app['2024']['Vegetação nativa'], 0)}% nativa</span></div>${Charts.bar(partes(p.app['2024']))}
      ${chaves()}
    </div>
    <h3>Estações CETESB nesta bacia (${e.length})</h3>
    ${e.length ? `<ul class="list">${e.map(x => itemEstacao(x)).join('')}</ul>` : '<p class="muted">Nenhuma estação nesta bacia.</p>'}`;
  $('#voltar').addEventListener('click', () => abrirPanorama());
  ligarItensEstacao();
  abrirAnalise();
}

function itemEstacao(x) {
  const p = x.properties, c = p.med ? iqaClasse(p.med.IQA) : null;
  return `<li data-id="${esc(p.id)}"><span><b>${esc(p.id)}</b><br><span class="muted">${esc(p.corpo)}</span></span>${c ? `<span class="badge" style="background:${c.cor}">IQA ${nf(p.med.IQA)}</span>` : '<span class="muted">sem dado</span>'}</li>`;
}
function ligarItensEstacao() {
  $$('#analise .list li[data-id]').forEach(li => li.addEventListener('click', () => {
    const f = state.data.est.features.find(x => x.properties.id === li.dataset.id);
    selecionarEstacao(f, true);
  }));
}

function selecionarEstacao(f, zoom) {
  const p = f.properties;
  deselecionar();
  state.stationSel = f;
  const bc = state.data.bcs.features.find(x => x.properties.id === p.id);
  if (bc) { L_.bc.addData(bc); L_.bc.addTo(map); restack(); }
  const [lng, lat] = f.geometry.coordinates;
  if (zoom || isMobile()) map.flyTo([lat, lng], Math.max(map.getZoom(), 10), { duration: .6 });
  if (bc && zoom) map.fitBounds(L_.bc.getBounds(), isMobile() ? { paddingBottomRight: [10, window.innerHeight * 0.55] } : { padding: [30, 30] });

  const c = p.med ? iqaClasse(p.med.IQA) : null;
  const params = Object.keys(PARAMS).filter(k => p.serie[k] && p.serie[k].length > 1);
  const ub = p.uso_bacia, anos = ub ? Object.keys(ub).map(Number).sort((a, b) => a - b) : [];
  const idx = { 'Vegetação nativa': 0, 'Pastagem': 1, 'Cana-de-açúcar': 2, 'Área urbanizada': 3, 'Mosaico de usos': 4 };
  const camadas = ['Vegetação nativa', 'Mosaico de usos', 'Pastagem', 'Cana-de-açúcar', 'Área urbanizada'].map(k => ({
    nome: k, cor: COR[k], valores: Object.fromEntries(anos.map(a => [a, ub[a][idx[k]]])),
  }));
  const u = a => ub && ub[a] ? ub[a] : null;
  const u85 = u(1985), u21 = u(2021);

  $('#analise').innerHTML = `
    <button class="btn" id="voltar">← Panorama</button>
    <p class="kicker" style="margin-top:12px">Estação CETESB · ${esc(p.bacia)}</p>
    <h2 class="title">${esc(p.id)}</h2>
    <p class="muted">${esc(p.corpo)} · série ${esc(p.ano_ini)}–${esc(p.ano_fim)}${p.area_km2 ? ' · bacia de contribuição ' + nf(p.area_km2, 0) + ' km²' : ''}</p>
    ${c ? `<p><span class="badge" style="background:${c.cor}">IQA ${nf(p.med.IQA)} · ${c.nome}</span> <span class="muted">mediana 2018–2021</span></p>
    <div class="stats">${['OD', 'DBO', 'E_coli', 'P_total', 'Turbidez'].map(k => `<div class="stat"><b>${nf(p.med[k], PARAMS[k].dec)}</b><span>${PARAMS[k].nome} (${PARAMS[k].un})</span></div>`).join('')}</div>`
      : '<p class="muted">Esta estação não tem mediana 2018–2021 na análise (poucos dados no período).</p>'}
    ${params.length ? `<div class="card"><h3>Série histórica</h3>
      <select id="selParam" aria-label="Parâmetro">${params.map(k => `<option value="${k}">${PARAMS[k].nome}${PARAMS[k].un ? ' (' + PARAMS[k].un + ')' : ''}</option>`).join('')}</select>
      <div id="grafParam"></div><p class="muted">Médias anuais (CETESB/SNIRH). Faixa azul: 2018–2021.</p></div>` : ''}
    ${ub ? `<div class="card"><h3>Uso do solo na bacia de contribuição</h3>${Charts.stacked(anos, camadas)}${chaves()}
      <p class="muted" style="margin-top:8px">Cana: ${seta(u85[2], u21[2])} · urbano: ${seta(u85[3], u21[3])} · veg. nativa: ${seta(u85[0], u21[0])} (1985 → 2021).</p></div>` : ''}
    <p class="muted">${bc ? 'A linha tracejada no mapa mostra a bacia de contribuição desta estação (delimitada com Copernicus DEM 30 m).' : ''} Associações não implicam causalidade.</p>`;
  $('#voltar').addEventListener('click', () => abrirPanorama());
  const sel = $('#selParam');
  if (sel) { const draw = () => { const k = sel.value; $('#grafParam').innerHTML = Charts.line(p.serie[k], { win: [2018, 2021], decimals: PARAMS[k].dec, label: PARAMS[k].un }); }; sel.addEventListener('change', draw); draw(); }
  abrirAnalise();
}

// ---------- busca ----------
let indice = [];
function montarBusca() {
  indice = [
    ...state.data.est.features.map(f => ({ tipo: 'Estação', nome: f.properties.id, sub: f.properties.corpo, chave: norm(f.properties.id + ' ' + f.properties.corpo), ir: () => selecionarEstacao(f, true) })),
    ...L_.n5.getLayers().map(l => ({ tipo: 'Bacia', nome: l.feature.properties.nome, sub: '', chave: norm(l.feature.properties.nome), ir: () => selecionarBacia(l, l.feature, true) })),
    ...L_.riosRot.getLayers().map(l => ({ tipo: 'Rio', nome: l.feature.properties.nome, sub: '', chave: norm(l.feature.properties.nome), ir: () => map.fitBounds(l.getBounds(), { padding: [60, 60] }) })),
  ];
  const q = $('#q'), ul = $('#results'); let ativo = -1, itens = [];
  const fechar = () => { ul.hidden = true; ativo = -1; };
  const mostrar = () => {
    const t = norm(q.value.trim());
    if (t.length < 2) return fechar();
    itens = indice.filter(i => i.chave.includes(t)).slice(0, 7);
    if (q.value.trim().length >= 3) itens.push({ tipo: 'Endereço', nome: `Buscar “${q.value.trim()}” no mapa`, sub: 'OpenStreetMap', ir: () => buscarEndereco(q.value.trim()) });
    ul.innerHTML = itens.map((i, n) => `<li data-n="${n}" aria-selected="${n === ativo}"><span>${esc(i.nome)}${i.sub ? ' <small>' + esc(i.sub) + '</small>' : ''}</span><small>${i.tipo}</small></li>`).join('');
    ul.hidden = false;
    $$('li', ul).forEach(li => li.addEventListener('mousedown', e => { e.preventDefault(); escolher(+li.dataset.n); }));
  };
  const escolher = n => { const i = itens[n]; if (!i) return; fechar(); if (i.tipo !== 'Endereço') q.value = i.nome; i.ir(); if (isMobile() && i.tipo !== 'Endereço') $('#sidebar').classList.remove('collapsed'); };
  q.addEventListener('input', () => { ativo = -1; mostrar(); });
  q.addEventListener('blur', fechar);
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ativo = (ativo + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length; mostrar(); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(ativo >= 0 ? ativo : 0); }
    else if (e.key === 'Escape') fechar();
  });
}

let marcadorEnd = null;
function buscarEndereco(texto) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&viewbox=-51,-20,-48,-22&q=' + encodeURIComponent(texto);
  toast('Buscando endereço…');
  fetch(url, { headers: { 'Accept-Language': 'pt-BR' } }).then(r => r.json()).then(res => {
    if (!res.length) return toast('Endereço não encontrado.');
    const r = res[0], ll = [+r.lat, +r.lon];
    if (marcadorEnd) map.removeLayer(marcadorEnd);
    marcadorEnd = L.marker(ll).addTo(map).bindPopup(esc(r.display_name)).openPopup();
    map.flyTo(ll, 15, { duration: .8 });
  }).catch(() => toast('Falha na busca de endereço.'));
}
