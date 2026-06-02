// ═══════════════════════════════════════════════════════════
//  MIP Argentina 1997 - INDEC - Miles de pesos
//  Sectores: C01, C04, C11, C13, C15
// ═══════════════════════════════════════════════════════════

const SECTORES = ['C01', 'C04', 'C11', 'C13', 'C15'];

const META = {
  C01: { nombre: 'Agricultura, ganadería, caza y silvicultura', corto: 'Agricultura', icon: '🌾', color: '#2d6a4f', cls: 'c01' },
  C04: { nombre: 'Industria manufacturera', corto: 'Ind. manuf.', icon: '🏭', color: '#2a7fb5', cls: 'c04' },
  C11: { nombre: 'Suministro de electricidad, gas y agua', corto: 'Electricidad', icon: '⚡', color: '#c07820', cls: 'c11' },
  C13: { nombre: 'Comercio mayorista y minorista', corto: 'Comercio', icon: '🛒', color: '#7b3fbf', cls: 'c13' },
  C15: { nombre: 'Transporte, almacenamiento y comunicaciones', corto: 'Transporte', icon: '🚛', color: '#b53030', cls: 'c15' },
};

// Matriz Z real (fila=productor → columna=comprador) en miles de $
const Z = {
  C01: { C01: 4585895, C04: 13661176, C11: 0, C13: 0, C15: 7 },
  C04: { C01: 3068451, C04: 32268537, C11: 277567, C13: 1776304, C15: 3005326 },
  C11: { C01: 126247, C04: 1982000, C11: 2025245, C13: 456578, C15: 264858 },
  C13: { C01: 561343, C04: 6641952, C11: 61466, C13: 235371, C15: 317249 },
  C15: { C01: 339292, C04: 6197991, C11: 697957, C13: 1422801, C15: 2419209 },
};

// VBP (Valor Bruto de Producción) real - miles de $
const VBP = { C01: 24317791, C04: 131577654, C11: 10392988, C13: 41889529, C15: 33808584 };

// Demanda final
const DF = { C01: 5715967, C04: 70930105, C11: 3682047, C13: 30939271, C15: 17238469 };

// Demanda intermedia total (suma de la columna) - miles de $
const DI_COL = { C01: 0, C04: 0, C11: 0, C13: 0, C15: 0 };

for (const fila in Z) {
  for (const col in Z[fila]) {
    DI_COL[col] += Z[fila][col];
  }
}

// VAB = VBP - DI_COL
const VAB = {};
SECTORES.forEach(s => { VAB[s] = VBP[s] - DI_COL[s]; });

// Coeficientes técnicos A_ij = Z_ij / VBP_j
const A = {};
SECTORES.forEach(f => {
  A[f] = {};
  SECTORES.forEach(c => { A[f][c] = Z[f][c] / VBP[c]; });
});

// Matriz inversa de Leontief
const matrixA = SECTORES.map(f =>
  SECTORES.map(c => A[f][c])
);
const I = math.identity(SECTORES.length)._data;
const IminusA = math.subtract(I, matrixA);
const L = math.inv(IminusA);
const LEONTIEF = {};
SECTORES.forEach((f, i) => {
  LEONTIEF[f] = {};
  SECTORES.forEach((c, j) => {
    LEONTIEF[f][c] = L[i][j];
  });
});

// Multiplicadores (proxy 1-sector: 1/(1 - suma_col_A))
const MULT = {};
SECTORES.forEach(c => {
  const suma = SECTORES.reduce((acc, f) => acc + A[f][c], 0);
  MULT[c] = { suma, valor: 1 / (1 - suma) };
});

// Formatear miles con puntos
function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '<span class="cero">—</span>';
  return Math.round(n).toLocaleString('es-AR');
}
function fmtM(n) { return (n / 1000000).toFixed(1) + ' M'; }
function fmtB(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }

// ── NAVEGACIÓN ──────────────────────────────────────────────
function mostrarSeccion(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
}

// ── CELDA INFO ───────────────────────────────────────────────
function infoCell(fila, col, val) {
  const el = document.getElementById('cell-info');
  const nF = META[fila].nombre;
  const nC = META[col].nombre;
  let msg;
  if (val === 0) {
    msg = `<span class="ci-val">📌 ${nF} → ${nC}: $0</span><br>No hay flujo de insumos registrado entre estos dos sectores en la MIP 1997.`;
  } else {
    const pct = ((val / VBP[col]) * 100).toFixed(2);
    msg = `<span class="ci-val">📌 ${nF} → ${nC}: $${val.toLocaleString('es-AR')} miles</span><br>
    Representa el <strong>${pct}%</strong> del VBP de ${META[col].corto}. 
    ${fila === 'C01' ? `El sector agropecuario vende como insumo a ${META[col].corto}, generando encadenamiento hacia adelante.` :
        col === 'C01' ? `El sector ${META[fila].corto} abastece al agro, generando encadenamiento hacia atrás del agro.` :
          `Flujo intermedio entre ${META[fila].corto} y ${META[col].corto}.`}`;
  }
  el.innerHTML = msg;
  document.querySelectorAll('table.mip td:not(.rl)').forEach(td => td.classList.remove('hl'));
  event.currentTarget.classList.add('hl');
}

// ── CONSTRUIR TABLA MIP ──────────────────────────────────────
function buildMIP() {
  const tbody = document.getElementById('mip-tbody');
  tbody.innerHTML = '';
  SECTORES.forEach(fila => {
    const tr = document.createElement('tr');
    let html = `<td class="rl">${META[fila].icon} ${META[fila].nombre}</td>`;
    SECTORES.forEach(col => {
      const val = Z[fila][col];
      const isAgro = fila === 'C01' || col === 'C01';
      const isSelf = fila === col;
      const cls = [isAgro ? 'agro-col' : '', isSelf ? 'self' : ''].filter(Boolean).join(' ');
      html += `<td class="${cls}" onclick="infoCell('${fila}','${col}',${val})">${val > 0 ? val.toLocaleString('es-AR') : '<span class="cero">—</span>'}</td>`;
    });
    // Totales de fila
    const totalFila = SECTORES.reduce((a, c) => a + Z[fila][c], 0);
    //html += `<td><strong>${totalFila.toLocaleString('es-AR')}</strong></td>`; // SUMATORIA FILAS
    html += `<td><strong>${DF[fila].toLocaleString('es-AR')}</strong></td>`;
    html += `<td>${VBP[fila].toLocaleString('es-AR')}</td>`;
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  // Tfoot: CI total columna
  const tfCI = document.getElementById('tf-ci');
  const tfVAB = document.getElementById('tf-vab');
  let htmlCI = '<td class="rl">Consumo intermedio (5 sect.)</td>';
  let htmlVAB = '<td class="rl">VAB a precios básicos</td>';
  SECTORES.forEach(col => {
    const ci5 = SECTORES.reduce((a, f) => a + Z[f][col], 0);
    const cls = col === 'C01' ? 'tf-agro' : '';
    htmlCI += `<td class="${cls}">${ci5.toLocaleString('es-AR')}</td>`;
    htmlVAB += `<td class="${col === 'C01' ? 'tf-agro' : ''}">${VAB[col].toLocaleString('es-AR')}</td>`;
  });
  htmlCI += '<td>—</td><td>—</td>';
  htmlVAB += '<td>—</td><td>—</td>';
  tfCI.innerHTML = htmlCI;
  tfVAB.innerHTML = htmlVAB;
}

// ── CHARTS (Chart.js) ────────────────────────────────────────
function buildCharts() {
  const colores = SECTORES.map(s => META[s].color);
  const nombres = SECTORES.map(s => META[s].corto);

  // VBP
  new Chart(document.getElementById('chartVBP'), {
    type: 'bar',
    data: {
      labels: nombres,
      datasets: [{
        label: 'VBP (miles $)', data: SECTORES.map(s => VBP[s]),
        backgroundColor: colores.map(c => c + 'cc'), borderColor: colores, borderWidth: 1.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '$' + ctx.raw.toLocaleString('es-AR') + ' miles' } } },
      scales: {
        y: {
          beginAtZero: true, grid: { color: 'rgba(0,0,0,.06)' },
          ticks: { callback: v => (v / 1000000).toFixed(0) + 'M' }
        }
      }
    }
  });

  // VAB / VBP
  new Chart(document.getElementById('chartVAB'), {
    type: 'doughnut',
    data: {
      labels: nombres,
      datasets: [{
        data: SECTORES.map(s => VAB[s]),
        backgroundColor: colores.map(c => c + 'cc'), borderColor: colores, borderWidth: 1.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ctx.label + ': $' + ctx.raw.toLocaleString('es-AR') } }
      }
    }
  });

  // Coef técnicos agro (cuánto del VBP de cada sector viene del agro)
  const barCont = document.getElementById('barrasCoefAgro');
  barCont.innerHTML = '';
  SECTORES.forEach(col => {
    const coef = A['C01'][col];
    barCont.innerHTML += `
      <div class="bar-row">
        <span class="bl">${META[col].icon} ${META[col].corto}</span>
        <div class="bar-track">
          <div class="bar-fill ${META[col].cls}" style="width:${coef * 100}%">${(coef * 100).toFixed(2)}%</div>
        </div>
      </div>`;
  });

  // Inversa de leontief agro (cuánto del VBP de cada sector viene del agro)
  const barCont2 = document.getElementById('barrasCoefAgroInversa');
  barCont2.innerHTML = '';
  SECTORES.forEach(col => {
    const coef = LEONTIEF['C01'][col];
    barCont2.innerHTML += `
      <div class="bar-row">
        <span class="bl">${META[col].icon} ${META[col].corto}</span>
        <div class="bar-track">
          <div class="bar-fill ${META[col].cls}" style="width:${coef * 100}%">${(coef * 100).toFixed(2)}%</div>
        </div>
      </div>`;
  });
}

// ── MULTIPLICADORES ──────────────────────────────────────────
function buildMult() {
  const grid = document.getElementById('multGrid');
  const expl = document.getElementById('multExpl');
  const explTextos = {
    C01: `El agro tiene un multiplicador de <strong>${MULT.C01.valor.toFixed(3)}</strong>. Esto significa que ante un incremento de $1 en la demanda final agropecuaria, la producción total de los 5 sectores aumenta en $${MULT.C01.valor.toFixed(2)}. Su suma de coeficientes técnicos (${(MULT.C01.suma * 100).toFixed(1)}% del VBP) refleja la demanda de insumos: principalmente industria manufacturera ($3.068 mill.) y transporte ($339 mill.).`,
    C04: `La industria manufacturera registra el <strong>mayor multiplicador (${MULT.C04.valor.toFixed(3)})</strong> de los 5 sectores. Cada peso de demanda final industrial genera $${MULT.C04.valor.toFixed(2)} de producción adicional, dado que absorbe insumos de todos los demás sectores: agrícolas, energía, comercio y transporte.`,
    C11: `Electricidad, gas y agua tiene un multiplicador de <strong>${MULT.C11.valor.toFixed(3)}</strong>. Su alto consumo propio (autoconsumo de $2.025.245 miles, coef. 0.195) refleja la naturaleza del sector. Es insumo crítico para la industria manufacturera ($1.982.000 miles).`,
    C13: `Comercio mayorista y minorista muestra el <strong>multiplicador más bajo (${MULT.C13.valor.toFixed(3)})</strong>. Su valor agregado es altísimo (73.9% del VBP), lo que implica que requiere pocos insumos intermedios de los 5 sectores. No compra nada del agro directamente (C01→C13 = 0).`,
    C15: `Transporte y comunicaciones registra un multiplicador de <strong>${MULT.C15.valor.toFixed(3)}</strong>. Recibe importantes insumos de manufactura ($6.197.991 miles), de sí mismo ($2.419.209 miles, autoconsumo) y de comercio ($1.422.801 miles). Es articulador clave de la cadena agro-exportadora.`,
  };

  grid.innerHTML = '';
  SECTORES.forEach(s => {
    const card = document.createElement('div');
    card.className = 'coef-card';
    card.style.borderColor = META[s].color;
    card.innerHTML = `
      <div class="cc-icon">${META[s].icon}</div>
      <div class="cc-nombre">${META[s].corto}</div>
      <div class="cc-val" style="color:${META[s].color}">${MULT[s].valor.toFixed(3)}</div>
      <div class="cc-sub">Σ coef. col = ${(MULT[s].suma * 100).toFixed(1)}%</div>`;
    card.onclick = () => {
      document.querySelectorAll('.coef-card').forEach(c => c.classList.remove('sel'));
      card.classList.add('sel');
      expl.innerHTML = explTextos[s];
    };
    grid.appendChild(card);
  });

  // Chart multiplicadores
  new Chart(document.getElementById('chartMult'), {
    type: 'bar',
    data: {
      labels: SECTORES.map(s => META[s].corto),
      datasets: [{
        label: 'Multiplicador',
        data: SECTORES.map(s => MULT[s].valor),
        backgroundColor: SECTORES.map(s => META[s].color + 'cc'),
        borderColor: SECTORES.map(s => META[s].color),
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'Mult.: ' + ctx.raw.toFixed(3) } } },
      scales: { y: { min: 1, max: 2.2, grid: { color: 'rgba(0,0,0,.06)' }, ticks: { callback: v => v.toFixed(2) } } }
    }
  });
}

// ── SIMULADOR ────────────────────────────────────────────────
document.getElementById('sliderMultiplier').value = MULT[document.getElementById('selectSector').value].valor.toFixed(3);
document.getElementById('title-panel-sim').innerText = "Sectores movilizados por: " + document.querySelector("#selectSector option:checked").textContent;
function simulacion_cambio() {
  const sectorSel = document.getElementById('selectSector').value;
  const mult = MULT[sectorSel].valor;
  document.getElementById('sliderMultiplier').value = mult.toFixed(3);
  simular();
}

function simular() {

  const selText = document.querySelector("#selectSector option:checked").textContent;
  document.getElementById('title-panel-sim').innerText = "Sectores movilizados por: " + selText;

  const shock = parseFloat(document.getElementById('sliderShock').value);
  const multiplicador = parseFloat(document.getElementById('sliderMultiplier').value);
  const sectorSel = document.getElementById('selectSector').value;
  document.getElementById('valShock').textContent = '$' + shock.toLocaleString('es-AR') + ' mill.';
  document.getElementById('valMultiplier').textContent = multiplicador.toLocaleString('es-AR');

  const mult = multiplicador;
  const totalEcon = (shock * mult).toFixed(1);

  // Impacto sobre cada sector usando coeficientes de la columna del sector
  const impactos = {};
  SECTORES.forEach(f => {
    impactos[f] = (shock * A[f][sectorSel] * mult).toFixed(1);
  });

  const grid = document.getElementById('resGrid');
  grid.innerHTML = `
    <div class="res-card dest">
      <div class="rt">Impacto total (5 sectores)</div>
      <div class="rv">$${parseFloat(totalEcon).toLocaleString('es-AR')}</div>
      <div class="ru">mult. = ${mult.toFixed(3)}</div>
    </div>` +
    SECTORES.map(s => `
    <div class="res-card">
      <div class="rt">${META[s].icon} ${META[s].corto}</div>
      <div class="rv" style="color:${META[s].color}">$${parseFloat(impactos[s]).toLocaleString('es-AR')}</div>
      <div class="ru">millones generados</div>
    </div>`).join('');

  // Barras de impacto
  const barCont = document.getElementById('barrasImpacto');
  const sumImpactos = Object.values(impactos).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  barCont.innerHTML = '';
  SECTORES.forEach(s => {
    const val = parseFloat(impactos[s]);
    const pct = (val / sumImpactos) * 100;
    console.log(pct)
    barCont.innerHTML += `
      <div class="bar-row">
        <span class="bl">${META[s].icon} ${META[s].corto}</span>
        <div class="bar-track">
          <div class="bar-fill ${META[s].cls}" style="width:${Math.max(pct, 2)}%">$${val.toLocaleString('es-AR')}M</div>
        </div>
      </div>`;
  });
}

// ── ENCADENAMIENTOS ──────────────────────────────────────────
const CADENAS = {
  atras: [
    { icon: '⚡', n: 'Electricidad, gas y agua', s: '', det: 'El agro consume <em>$126.247 miles</em> de electricidad, gas y agua como insumo de riego, secado de granos y refrigeración. Coeficiente técnico: 0.52%.', id: 'C11' },
    { icon: '🏭', n: 'Ind. manufacturera', s: '', det: 'La manufactura provee al agro <em>$3.068.451 miles</em> en insumos: maquinaria agrícola, agroquímicos, fertilizantes y combustibles. Es el mayor insumo del agro. Coef.: 12.62% del VBP agro.', id: 'C04' },
    { icon: '🛒', n: 'Comercio mayorista', s: '', det: 'El comercio le vende al agro bienes intermedios por <em>$561.343 miles</em>: semillas, insumos varios vía distribuidores. Coef.: 2.31%.', id: 'C13' },
    { icon: '🌾', n: 'AGRO', s: 'Sector central', det: 'El sector agropecuario (C01) es el nodo generador. Sus encadenamientos hacia atrás (lo que compra) equivalen al <em>39.5% de su propio VBP</em>. Depende fuertemente de la industria manufacturera.', id: 'C01' },
    { icon: '🚛', n: 'Transporte', s: '', det: 'Transporte y comunicaciones le vende al agro <em>$339.292 miles</em>: logística de insumos, telecomunicaciones rurales. Coef.: 1.40%.', id: 'C15' },
  ],
  adelante: [
    { icon: '🌾', n: 'AGRO', s: 'Sector central', det: 'La producción agropecuaria (C01) genera <em>$24.317.791 miles de VBP</em>. Como proveedor de insumos, su principal destino es la industria manufacturera, que absorbe el 56.2% de su VBP.', id: 'C01' },
    { icon: '🏭', n: 'Ind. manufacturera', s: '', det: 'El agro vende a manufactura <em>$13.661.176 miles</em> (56.2% del VBP agro): granos, oleaginosas, carnes y fibras que abastecen a la agroindustria exportadora.', id: 'C04' },
    { icon: '⚡', n: 'Electricidad', s: '', det: 'El flujo de C01 hacia C11 es <em>$0</em>: el agro no vende como insumo a la energía. La relación es inversa (C11 provee al agro).', id: 'C11' },
    { icon: '🛒', n: 'Comercio', s: '', det: 'El flujo C01→C13 es <em>$0</em> según la MIP 1997. Los productos agropecuarios llegan al comercio con transformación industrial previa, no como insumo directo al sector comercio.', id: 'C13' },
    { icon: '🚛', n: 'Transporte', s: '', det: 'El agro vende apenas <em>$7 miles</em> a transporte como insumo. La relación dominante es inversa: el transporte presta servicios al agro, no al revés.', id: 'C15' },
  ]
};

let cadenaActual = 'atras';
function mostrarCadena(tipo) {
  cadenaActual = tipo;
  document.getElementById('btnAtras').classList.toggle('active', tipo === 'atras');
  document.getElementById('btnAdelante').classList.toggle('active', tipo === 'adelante');
  renderCadena();
}
function renderCadena() {
  const cont = document.getElementById('cadenaVis');
  const data = CADENAS[cadenaActual];
  cont.innerHTML = '';
  data.forEach((paso, i) => {
    const div = document.createElement('div');
    div.className = 'cadena-paso';
    div.innerHTML = `<div class="cp-ic">${paso.icon}</div><div class="cp-n">${paso.n}</div><div class="cp-s">${paso.s}</div>`;
    div.onclick = () => {
      document.querySelectorAll('.cadena-paso').forEach(p => p.classList.remove('lit'));
      div.classList.add('lit');
      document.getElementById('cadena-det').innerHTML = `<em>${paso.n}:</em> ${paso.det}`;
    };
    cont.appendChild(div);
    if (i < data.length - 1) {
      const arr = document.createElement('div');
      arr.className = 'cadena-arrow';
      arr.textContent = cadenaActual === 'atras' ? '←' : '→';
      cont.appendChild(arr);
    }
  });
}

// ── QUIZ ─────────────────────────────────────────────────────
const PREGUNTAS = [
  {
    p: 'Según la MIP Argentina 1997, ¿cuál es el principal comprador de insumos del sector agropecuario?',
    opts: ['Comercio mayorista y minorista', 'Industria manufacturera', 'Transporte y comunicaciones', 'Electricidad, gas y agua'],
    resp: 1,
    exp: `Correcto. El sector agro vende $13.661.176 miles a la industria manufacturera, representando el 56.2% de su VBP. Este flujo alimenta la agroindustria de aceites, harinas, carnes y derivados.`
  },
  {
    p: `¿Qué significa que el coeficiente técnico A(Agro, Ind. Manu) sea aproximadamente 0.1038?`,
    opts: [
      'El 10.38% del VBP del agro proviene de la manufactura',
      'Por cada peso producido por la industria manufacturera, se requieren $0.1038 de insumos del agro',
      'El agro vende el 10.38% de su producción a la manufactura',
      'La manufactura usa el 10.38% de su VBP en insumos agropecuarios'
    ],
    resp: 1,
    exp: 'El coeficiente técnico A_ij = Z_ij / VBP_j indica cuántos pesos de insumo del sector i se necesitan por cada peso producido por el sector j. A(Agro, Ind. Manu) = 13.661.176 / 131.577.654 ≈ 0.1038: por cada peso de producción manufacturera, se demandan $0.1038 de insumos agropecuarios.'
  },
  {
    p: '¿Cuál es el sector con mayor Valor Agregado Bruto (VAB) en proporción a su VBP entre los 5 analizados?',
    opts: ['Agricultura', 'Industria manufacturera', 'Comercio mayorista', 'Transporte'],
    resp: 2,
    exp: `El comercio mayorista y minorista (C13) tiene un VAB/VBP = 73.9%, el más alto de los 5 sectores. Esto indica que el comercio incorpora poco consumo intermedio en relación a su producción; su valor surge principalmente del trabajo y la intermediación, no de insumos físicos.`
  },
  {
    p: '¿Cuál es la interpretación correcta del flujo Z(Agricultura→Comercio mayorista y minorista) = 0 en la MIP 1997?',
    opts: [
      'El agro no exporta al exterior',
      'El sector comercio no genera valor agregado',
      'El agro no abastece al comercio directamente como insumo intermedio',
      'El agro y el comercio pertenecen al mismo sector'
    ],
    resp: 2,
    exp: 'En la MIP, Z_ij registra ventas intermedias de i a j. Z(C01→C13)=0 significa que el sector agropecuario no vende insumos directamente al comercio. Esto es esperable: los productos agropecuarios llegan al comercio ya procesados por la industria manufacturera o directamente como demanda final (consumo de hogares), no como insumo de la actividad comercial.'
  },
  {
    p: `La industria manufacturera tiene el multiplicador más alto (${MULT.C04.valor.toFixed(3)}) entre los 5 sectores. ¿Cuál es la razón principal?`,
    opts: [
      'Porque exporta más que los demás sectores',
      'Porque tiene mayor VBP absoluto',
      'Porque demanda insumos de todos los sectores: agro, energía, comercio y transporte',
      'Porque genera menos empleo directo'
    ],
    resp: 2,
    exp: `El multiplicador de Leontief es más alto cuando la suma de los coeficientes técnicos de la columna es mayor. C04 tiene Σ coef = ${(MULT.C04.suma * 100).toFixed(1)}%: demanda $0.1038 de agro, $0.1508 de sí misma, $0.0151 de energía, $0.0505 de comercio y $0.0471 de transporte. Esta articulación con múltiples sectores produce el mayor efecto multiplicador.`
  }
];

let quizEstado = PREGUNTAS.map(() => ({ respondida: false, correcta: false }));

function renderQuiz() {
  const cont = document.getElementById('quizCont');
  cont.innerHTML = '';
  PREGUNTAS.forEach((q, qi) => {
    const est = quizEstado[qi];
    const opts = q.opts.map((o, oi) => {
      let cls = 'opcion';
      if (est.respondida) cls += oi === q.resp ? ' correcta' : ' incorrecta';
      return `<div class="${cls}" onclick="responder(${qi},${oi})">${o}</div>`;
    }).join('');
    const fb = est.respondida
      ? `<div class="feedback ${est.correcta ? 'ok' : 'mal'}">${est.correcta ? '✅ ' : '❌ '}${q.exp}</div>`
      : '';
    cont.innerHTML += `<div class="quiz-card"><p class="qp">${qi + 1}. ${q.p}</p><div class="opciones">${opts}</div>${fb}</div>`;
  });
  const tot = quizEstado.filter(e => e.respondida).length;
  const ok = quizEstado.filter(e => e.correcta).length;
  if (tot === PREGUNTAS.length) {
    document.getElementById('quizScore').style.display = 'block';
    document.getElementById('quizScore').textContent = `Resultado: ${ok}/${PREGUNTAS.length} correctas`;
    document.getElementById('btnReini').style.display = 'block';
  }
}
function responder(qi, oi) {
  if (quizEstado[qi].respondida) return;
  quizEstado[qi].respondida = true;
  quizEstado[qi].correcta = oi === PREGUNTAS[qi].resp;
  renderQuiz();
}
function reiniciarQuiz() {
  quizEstado = PREGUNTAS.map(() => ({ respondida: false, correcta: false }));
  document.getElementById('quizScore').style.display = 'none';
  document.getElementById('btnReini').style.display = 'none';
  renderQuiz();
}

// ── INICIALIZACIÓN ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildMIP();
  buildCharts();
  buildMult();
  renderCadena();
  renderQuiz();
  simular();
});
