/* Geoportal 3D – Bacias que abastecem Rio Preto
   MapLibre GL JS + relevo (Terrarium/AWS Open Data). Sem build. */
'use strict';

const GRUPOS = [
  { k: 'Vegetação nativa', cor: '#1f8d49' }, { k: 'Mosaico de usos', cor: '#ffefc3' }, { k: 'Pastagem', cor: '#edde8e' },
  { k: 'Cana-de-açúcar', cor: '#db7093' }, { k: 'Outras lavouras', cor: '#b05fc0' }, { k: 'Silvicultura', cor: '#7a5900' },
  { k: 'Área urbanizada', cor: '#d4271e' }, { k: 'Água', cor: '#2532e4' }, { k: 'Outros', cor: '#9aa5ad' },
];
const IQA_CLASSES = [
  { nome: 'Ótima', min: 79, cor: '#1f6fd1' }, { nome: 'Boa', min: 51, cor: '#2e9e4f' }, { nome: 'Regular', min: 36, cor: '#e6b800' },
  { nome: 'Ruim', min: 19, cor: '#d93a2b' }, { nome: 'Péssima', min: -1, cor: '#6b2b8f' },
];
const SEM_DADO = '#9aa5ad';
const LEGENDA_IDS = [20, 21, 15, 3, 24, 33, 39, 47, 11, 46, 9];
const VIEWS = { tilt: { pitch: 60, bearing: -20 }, top: { pitch: 0, bearing: 0 }, low: { pitch: 78, bearing: 35 } };
const nf = Charts.nf;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iqaClasse = v => (v == null ? null : IQA_CLASSES.find(c => v > c.min) || IQA_CLASSES[IQA_CLASSES.length - 1]);

const state = { ex: 4, spin: false, n5: {}, est: {}, bcs: {}, meta: null };

function toast(msg, ms = 4000) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms); }
const J = f => fetch('data/' + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });

// bbox [oeste, sul, leste, norte] de uma geometria GeoJSON
function bboxOf(geom) {
  let b = [180, 90, -180, -90];
  (function walk(c) { if (typeof c[0] === 'number') { b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])]; } else c.forEach(walk); })(geom.coordinates);
  return b;
}

Promise.all([J('bacias_nivel5.geojson'), J('rios.geojson'), J('estacoes.geojson'), J('etes.geojson'), J('bacias_estacoes.geojson'), J('limite_sjrp.geojson'), J('municipios.geojson'), J('raster_meta.json')])
  .then(([n5, rios, est, etes, bcs, sjrp, mun, meta]) => iniciar({ n5, rios, est, etes, bcs, sjrp, mun, meta }))
  .catch(e => { console.error(e); toast('Não foi possível carregar os dados: ' + e.message, 9000); });

function iniciar(d) {
  state.meta = d.meta;
  d.n5.features.forEach(f => { state.n5[f.properties.cod] = f; });
  d.est.features.forEach(f => { const p = f.properties; p.cor = p.med ? iqaClasse(p.med.IQA).cor : SEM_DADO; state.est[p.id] = f; });
  d.bcs.features.forEach(f => { state.bcs[f.properties.id] = f; });

  // colunas: quadrados ao redor de cada estação, altura ~ log10(E. coli)
  const colunas = { type: 'FeatureCollection', features: d.est.features.filter(f => f.properties.med && f.properties.med.E_coli).map(f => {
    const [x, y] = f.geometry.coordinates, h = 0.0055, hx = h / Math.cos(y * Math.PI / 180);
    return { type: 'Feature', properties: { id: f.properties.id, cor: f.properties.cor, h: Math.max(0, (Math.log10(f.properties.med.E_coli) - 1)) * 3000 },
      geometry: { type: 'Polygon', coordinates: [[[x - hx, y - h], [x + hx, y - h], [x + hx, y + h], [x - hx, y + h], [x - hx, y - h]]] } };
  }) };

  const [[s, w], [n, e]] = d.meta.bounds;
  let map;
  try {
    map = new maplibregl.Map({
      container: 'map', center: [-49.5, -20.85], zoom: 8.4, pitch: 55, bearing: -20, maxPitch: 80, minZoom: 6, maxZoom: 16.5, hash: false,
      attributionControl: { compact: true, customAttribution: 'Uso do solo: MapBiomas Col. 10 · Hidrografia/ETEs: ANA · Água: CETESB/SNIRH · Limites: IBGE' },
      style: {
        version: 8,
        sources: {
          sat: { type: 'raster', tileSize: 256, maxzoom: 18, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Imagens © Esri, Maxar, Earthstar Geographics' },
          osm: { type: 'raster', tileSize: 256, maxzoom: 19, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '© OpenStreetMap contributors' },
          dem: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14, tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], attribution: 'Relevo: Mapzen/AWS Terrain Tiles (SRTM, ASTER e outras fontes)' },
        },
        layers: [
          { id: 'sat', type: 'raster', source: 'sat' },
          { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } },
          { id: 'hill', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#000000', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#000000' } },
        ],
        terrain: { source: 'dem', exaggeration: state.ex },
      },
    });
  } catch (err) { console.error(err); toast('Seu navegador não conseguiu iniciar o WebGL, necessário para o mapa 3D.', 12000); return; }

  window.map3d = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
  map.on('error', e => console.warn('map error', e && e.error && e.error.message));

  map.on('load', () => {
    map.addSource('uso', { type: 'image', url: 'img/uso_2024.png', coordinates: [[w, n], [e, n], [e, s], [w, s]] });
    map.addLayer({ id: 'uso', type: 'raster', source: 'uso', paint: { 'raster-opacity': 0.8, 'raster-fade-duration': 0 } });

    map.addSource('n5', { type: 'geojson', data: d.n5 });
    map.addSource('rios', { type: 'geojson', data: d.rios });
    map.addSource('sjrp', { type: 'geojson', data: d.sjrp });
    map.addSource('bcs', { type: 'geojson', data: d.bcs });
    map.addSource('etes', { type: 'geojson', data: d.etes });
    map.addSource('est', { type: 'geojson', data: d.est });
    map.addSource('col', { type: 'geojson', data: colunas });

    map.addLayer({ id: 'n5-fill', type: 'fill', source: 'n5', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.001 } });
    map.addLayer({ id: 'n5-line', type: 'line', source: 'n5', paint: { 'line-color': '#ffffff', 'line-width': 2.2 } });
    map.addLayer({ id: 'rios', type: 'line', source: 'rios', paint: { 'line-color': '#3db8ff', 'line-width': 1.4, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'bc-fill', type: 'fill', source: 'bcs', filter: ['==', ['get', 'id'], ''], paint: { 'fill-color': '#00e5ff', 'fill-opacity': 0.14 } });
    map.addLayer({ id: 'bc-line', type: 'line', source: 'bcs', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#00e5ff', 'line-width': 2.5, 'line-dasharray': [3, 2] } });
    map.addLayer({ id: 'sjrp', type: 'line', source: 'sjrp', paint: { 'line-color': '#ff3b30', 'line-width': 2.8 } });
    map.addLayer({ id: 'n5-sel', type: 'line', source: 'n5', filter: ['==', ['get', 'cod'], ''], paint: { 'line-color': '#ffd400', 'line-width': 4 } });
    map.addLayer({ id: 'etes', type: 'circle', source: 'etes', paint: { 'circle-radius': 5, 'circle-color': '#e07b00', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'col', type: 'fill-extrusion', source: 'col', paint: { 'fill-extrusion-color': ['get', 'cor'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.88 } });
    map.addLayer({ id: 'est', type: 'circle', source: 'est', paint: { 'circle-radius': 8, 'circle-color': ['get', 'cor'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });

    const bb = d.n5.features.reduce((a, f) => { const b = bboxOf(f.geometry); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }, [180, 90, -180, -90]);
    state.bbox = bb;
    map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 40, pitch: 55, bearing: -20, animate: false });

    legendas(); ligarUI(map); ligarMapa(map);
  });
}

// ---------- legendas ----------
function legendas() {
  $('#legendUso').innerHTML = LEGENDA_IDS.map(id => { const c = state.meta.classes.find(x => x.valor === id); return c ? `<li><span class="sw" style="background:${c.cor}"></span>${esc(c.nome)}</li>` : ''; }).join('');
  const FX = {'Ótima':'80–100','Boa':'52–79','Regular':'37–51','Ruim':'20–36','Péssima':'0–19'}; $('#legendIqa').innerHTML = '<li class="lt"><b>IQA · Índice de Qualidade das Águas</b> (CETESB)<br><small>Cor da estação = classe da mediana 2018–2021. Quanto maior o IQA, melhor a água.</small></li>' + IQA_CLASSES.map(c => `<li><i class="dot" style="background:${c.cor}"></i>${c.nome} <small>(IQA ${FX[c.nome]})</small></li>`).join('') + `<li><i class="dot" style="background:${SEM_DADO}"></i>Sem dado</li>`;
}

// ---------- controles ----------
function ligarUI(map) {
  $('#toggle').addEventListener('click', () => { const p = $('#panel'); const c = p.classList.toggle('collapsed'); $('#toggle').setAttribute('aria-expanded', !c); });
  $$('[data-view]').forEach(b => b.addEventListener('click', () => {
    pararGiro(); const v = VIEWS[b.dataset.view];
    map.easeTo({ pitch: v.pitch, bearing: v.bearing, duration: 1200 });
  }));
  $('#spin').addEventListener('click', () => (state.spin ? pararGiro() : iniciarGiro(map)));
  ['mousedown', 'wheel', 'touchstart'].forEach(ev => map.getCanvas().addEventListener(ev, pararGiro, { passive: true }));

  $('#ex').addEventListener('input', e => { state.ex = +e.target.value; $('#exV').textContent = state.ex + '×'; map.setTerrain({ source: 'dem', exaggeration: state.ex }); });
  $$('.seg button').forEach(b => b.addEventListener('click', () => {
    $$('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const a = b.dataset.ano;
    if (a === 'off') { map.setLayoutProperty('uso', 'visibility', 'none'); return; }
    map.setLayoutProperty('uso', 'visibility', 'visible');
    map.getSource('uso').updateImage({ url: `img/uso_${a}.png` });
  }));
  $('#op').addEventListener('input', e => map.setPaintProperty('uso', 'raster-opacity', +e.target.value));
  $$('input[name=base]').forEach(r => r.addEventListener('change', () => {
    map.setLayoutProperty('sat', 'visibility', r.value === 'sat' ? 'visible' : 'none');
    map.setLayoutProperty('osm', 'visibility', r.value === 'osm' ? 'visible' : 'none');
  }));
  const grupos = { 'c-hill': ['hill'], 'c-n5': ['n5-fill', 'n5-line', 'n5-sel'], 'c-rios': ['rios'], 'c-sjrp': ['sjrp'], 'c-est': ['est'], 'c-col': ['col'], 'c-ete': ['etes'] };
  Object.entries(grupos).forEach(([id, ls]) => $('#' + id).addEventListener('change', e => ls.forEach(l => map.setLayoutProperty(l, 'visibility', e.target.checked ? 'visible' : 'none'))));
}

function iniciarGiro(map) {
  state.spin = true; $('#spin').setAttribute('aria-pressed', 'true');
  const passo = () => { if (!state.spin) return; map.setBearing(map.getBearing() + 0.12); requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
}
function pararGiro() { state.spin = false; $('#spin').setAttribute('aria-pressed', 'false'); }

// ---------- interação com o mapa ----------
function ligarMapa(map) {
  const hoverPop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
  const camadasEst = ['est', 'col'];

  map.on('mousemove', e => {
    const el = map.queryTerrainElevation(e.lngLat);
    $('#readout').textContent = el == null ? 'Altitude: –' : `Altitude: ${nf(el / state.ex, 0)} m`;
    const fs = map.queryRenderedFeatures(e.point, { layers: camadasEst.filter(l => map.getLayoutProperty(l, 'visibility') !== 'none') });
    if (fs.length) {
      map.getCanvas().style.cursor = 'pointer';
      const f = state.est[fs[0].properties.id], p = f.properties, c = p.med ? iqaClasse(p.med.IQA) : null;
      hoverPop.setLngLat(f.geometry.coordinates).setHTML(`<b>${esc(p.id)}</b>${esc(p.corpo)}<br>${c ? 'IQA ' + nf(p.med.IQA) + ' (' + c.nome + ')' : 'Sem mediana 2018–2021'}`).addTo(map);
    } else {
      hoverPop.remove();
      map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: ['n5-fill'] }).length ? 'pointer' : '';
    }
  });

  map.on('click', e => {
    pararGiro();
    const fs = map.queryRenderedFeatures(e.point, { layers: camadasEst.filter(l => map.getLayoutProperty(l, 'visibility') !== 'none') });
    if (fs.length) return selecionarEstacao(map, fs[0].properties.id);
    const bs = map.queryRenderedFeatures(e.point, { layers: ['n5-fill'] });
    if (bs.length) return selecionarBacia(map, bs[0].properties.cod);
    limpar(map);
  });
}

function limpar(map) {
  map.setFilter('n5-sel', ['==', ['get', 'cod'], '']); map.setFilter('bc-fill', ['==', ['get', 'id'], '']); map.setFilter('bc-line', ['==', ['get', 'id'], '']);
  $('#info').hidden = true;
}
const fecharBtn = '<button class="x" aria-label="Fechar" onclick="limpar(window.map3d)">×</button>';
const parte = pct => GRUPOS.map(g => ({ cor: g.cor, valor: pct[g.k] || 0, nome: g.k }));
const seta = (a, b) => `${nf(a, 1)}% → ${nf(b, 1)}%`;

function selecionarBacia(map, cod) {
  limpar(map);
  const f = state.n5[cod], p = f.properties, a = p.uso['1985'], b = p.uso['2024'];
  map.setFilter('n5-sel', ['==', ['get', 'cod'], cod]);
  const bb = bboxOf(f.geometry);
  map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { top: 60, bottom: 60, left: 330, right: 380 }, pitch: map.getPitch(), bearing: map.getBearing(), maxZoom: 11, duration: 1400 });
  const est = Object.values(state.est).filter(x => x.properties.bacia === p.nome);
  $('#info').innerHTML = `${fecharBtn}<h3>${esc(p.nome)}</h3>
    <div class="muted">Ottobacia nível 5 · ${nf(p.area_km2, 0)} km² · ${est.length} estação(ões) CETESB</div>
    <div class="grid">
      <div><b>${seta(a['Cana-de-açúcar'], b['Cana-de-açúcar'])}</b><span>Cana</span></div>
      <div><b>${seta(a['Vegetação nativa'], b['Vegetação nativa'])}</b><span>Veg. nativa</span></div>
      <div><b>${seta(a['Área urbanizada'], b['Área urbanizada'])}</b><span>Área urbana</span></div>
    </div>
    <div class="bl">1985</div>${Charts.bar(parte(a))}<div class="bl">2024</div>${Charts.bar(parte(b))}
    <div class="muted">Clique nas estações para ver a qualidade da água.</div>`;
  $('#info').hidden = false; if (window.innerHeight < 800) $('#legend').open = false;
}

function selecionarEstacao(map, id) {
  limpar(map);
  const f = state.est[id], p = f.properties, c = p.med ? iqaClasse(p.med.IQA) : null;
  map.setFilter('bc-fill', ['==', ['get', 'id'], id]); map.setFilter('bc-line', ['==', ['get', 'id'], id]);
  const bc = state.bcs[id];
  if (bc) { const bb = bboxOf(bc.geometry); map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { top: 60, bottom: 60, left: 330, right: 380 }, pitch: map.getPitch(), bearing: map.getBearing(), maxZoom: 11, duration: 1400 }); }
  const u = p.uso_bacia && p.uso_bacia[2021];
  const med = p.med;
  $('#info').innerHTML = `${fecharBtn}<h3>${esc(p.id)}</h3>
    <div class="muted">${esc(p.corpo)} · ${esc(p.bacia)}<br>série ${esc(p.ano_ini)}–${esc(p.ano_fim)}${p.area_km2 ? ' · bacia de contribuição ' + nf(p.area_km2, 0) + ' km²' : ''}</div>
    ${c ? `<p><span class="badge" style="background:${c.cor}">IQA ${nf(med.IQA)} · ${c.nome}</span> <span class="muted">mediana 2018–2021</span></p>
    <div class="grid">
      <div><b>${nf(med.OD, 1)}</b><span>OD (mg/L)</span></div><div><b>${nf(med.DBO, 1)}</b><span>DBO (mg/L)</span></div><div><b>${nf(med.E_coli, 0)}</b><span>E. coli (NMP/100 mL)</span></div>
      <div><b>${nf(med.P_total, 3)}</b><span>Fósforo (mg/L)</span></div><div><b>${nf(med.Turbidez, 1)}</b><span>Turbidez (UT)</span></div><div><b>${nf(p.area_km2 || 0, 0)}</b><span>Bacia (km²)</span></div>
    </div>` : '<p class="muted">Sem mediana 2018–2021 na análise.</p>'}
    ${u ? `<div class="bl">Uso do solo na bacia de contribuição, 2021</div>${Charts.bar([
      { cor: GRUPOS[0].cor, valor: u[0], nome: 'Vegetação nativa' }, { cor: GRUPOS[1].cor, valor: u[4], nome: 'Mosaico de usos' }, { cor: GRUPOS[2].cor, valor: u[1], nome: 'Pastagem' },
      { cor: GRUPOS[3].cor, valor: u[2], nome: 'Cana-de-açúcar' }, { cor: GRUPOS[6].cor, valor: u[3], nome: 'Área urbanizada' }])}
    <div class="muted">Nativa ${nf(u[0], 0)}% · pastagem ${nf(u[1], 0)}% · cana ${nf(u[2], 0)}% · urbano ${nf(u[3], 0)}%</div>` : ''}
    <div class="muted" style="margin-top:6px">Associação não implica causalidade.</div>`;
  $('#info').hidden = false; if (window.innerHeight < 800) $('#legend').open = false;
}


