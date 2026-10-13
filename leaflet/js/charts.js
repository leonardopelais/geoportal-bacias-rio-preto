/* Gráficos SVG sem dependências */
const Charts = (() => {
  const nf = (v, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /** Série temporal: points = [[ano, valor], ...]; win = [anoIni, anoFim] destaca a janela usada na mediana */
  function line(points, { win = null, decimals = 1, label = '' } = {}) {
    if (!points || points.length < 2) return '<p class="muted">Série insuficiente para o gráfico.</p>';
    const W = 340, H = 160, m = { l: 40, r: 10, t: 10, b: 22 };
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), yMax = niceMax(Math.max(...ys) * 1.05);
    const X = v => m.l + (x1 === x0 ? 0 : (v - x0) / (x1 - x0)) * (W - m.l - m.r);
    const Y = v => H - m.b - (v / yMax) * (H - m.t - m.b);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = (yMax / 4) * i, y = Y(v);
      g += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/><text x="${m.l - 5}" y="${y + 3}" text-anchor="end">${nf(v, yMax < 10 ? 1 : 0)}</text>`;
    }
    const span = x1 - x0, step = span > 25 ? 10 : span > 10 ? 5 : span > 5 ? 2 : 1;
    for (let a = Math.ceil(x0 / step) * step; a <= x1; a += step) g += `<text x="${X(a)}" y="${H - 6}" text-anchor="middle">${a}</text>`;
    if (win) g += `<rect class="band" x="${X(Math.max(x0, win[0]))}" y="${m.t}" width="${Math.max(2, X(Math.min(x1, win[1])) - X(Math.max(x0, win[0])))}" height="${H - m.t - m.b}"/>`;
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    g += `<path class="line" d="${d}"/>`;
    g += points.map(p => `<circle class="pt" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.4"><title>${p[0]}: ${nf(p[1], decimals)} ${label}</title></circle>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Série temporal">${g}</svg>`;
  }

  /** Áreas empilhadas (% do uso do solo ao longo dos anos). layers = [{nome, cor, valores:{ano:%}}] de baixo para cima */
  function stacked(years, layers) {
    const W = 340, H = 170, m = { l: 34, r: 8, t: 8, b: 22 };
    const x0 = years[0], x1 = years[years.length - 1];
    const X = v => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
    const Y = v => H - m.b - (v / 100) * (H - m.t - m.b);
    const base = years.map(() => 0);
    let g = '';
    [0, 25, 50, 75, 100].forEach(v => { g += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 5}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`; });
    layers.forEach(L => {
      const top = years.map((a, i) => base[i] + (L.valores[a] || 0));
      const up = years.map((a, i) => `${X(a).toFixed(1)},${Y(top[i]).toFixed(1)}`);
      const dn = years.map((a, i) => `${X(a).toFixed(1)},${Y(base[i]).toFixed(1)}`).reverse();
      g += `<polygon points="${up.concat(dn).join(' ')}" fill="${L.cor}" stroke="rgba(0,0,0,.25)" stroke-width=".5"><title>${L.nome}</title></polygon>`;
      top.forEach((v, i) => base[i] = v);
    });
    for (let a = 1990; a <= x1; a += 10) g += `<text x="${X(a)}" y="${H - 6}" text-anchor="middle">${a}</text>`;
    g += `<text x="${X(x0)}" y="${H - 6}" text-anchor="start">${x0}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do uso do solo">${g}</svg>`;
  }

  /** Barra 100% horizontal. partes = [{cor, valor, nome}] */
  function bar(partes) {
    return `<div class="bar" role="img">${partes.filter(p => p.valor > 0).map(p => `<i style="width:${p.valor}%;background:${p.cor}" title="${p.nome}: ${nf(p.valor, 1)}%"></i>`).join('')}</div>`;
  }

  return { line, stacked, bar, nf };
})();
