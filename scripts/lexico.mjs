// Genera lexico.js a partir de los CSV del diccionario de OpenRussian
// (https://github.com/Badestrand/russian-dictionary, CC BY-SA 4.0).
// Uso: node scripts/lexico.mjs <carpeta-con-los-csv>
// Toma las palabras más frecuentes de cada tabla (los CSV vienen ordenados por frecuencia)
// y todas las que aparecen en index.html, llevadas a su forma de diccionario.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DIR = process.argv[2];
if (!DIR) { console.error('Falta la carpeta con los CSV'); process.exit(1); }
const TOPE = { nouns: 2500, adjectives: 1000, verbs: 1800, others: 1500 };

const limpiar = s => (s || '').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
const desnudo = s => s.replace(/'/g, '').replace(/ё/g, 'е').toLowerCase();

function leer(nombre) {
  const lineas = readFileSync(DIR + '/' + nombre + '.csv', 'utf8').split(/\r?\n/).filter(Boolean);
  const cab = lineas.shift().split('\t');
  return lineas.map(l => { const c = l.split('\t'); const o = {}; cab.forEach((k, i) => o[k] = limpiar(c[i])); return o; })
    .filter(o => o.bare && /^[а-яё\- ]+$/i.test(o.bare));
}
// Traducciones: se quitan palabras sueltas que no son inglés (artefactos del origen).
const traducir = t => limpiar(t).split(', ').filter(x => /^[a-z0-9 ;()'.\-\/]+$/i.test(x)).slice(0, 6).join(', ');

const tablas = {
  nouns: { campos: ['sg_nom', 'sg_gen', 'sg_dat', 'sg_acc', 'sg_inst', 'sg_prep', 'pl_nom', 'pl_gen', 'pl_dat', 'pl_acc', 'pl_inst', 'pl_prep'],
    fila: o => [o.accented, traducir(o.translations_en), o.gender, +o.animate || 0, +o.indeclinable || 0, o.partner] },
  adjectives: { campos: ['comparative', 'superlative', 'short_m', 'short_f', 'short_n', 'short_pl',
      ...['m', 'f', 'n', 'pl'].flatMap(g => ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'].map(c => 'decl_' + g + '_' + c))],
    fila: o => [o.accented, traducir(o.translations_en)] },
  verbs: { campos: ['imperative_sg', 'imperative_pl', 'past_m', 'past_f', 'past_n', 'past_pl', 'presfut_sg1', 'presfut_sg2', 'presfut_sg3', 'presfut_pl1', 'presfut_pl2', 'presfut_pl3'],
    fila: o => [o.accented, traducir(o.translations_en), o.aspect === 'perfective' ? 'pf' : o.aspect === 'imperfective' ? 'impf' : '', (o.partner || '').replace(/^-$/, '')] },
  others: { campos: [], fila: o => [o.accented, traducir(o.translations_en)] },
};

// Correcciones puntuales de artefactos conocidos del origen.
const CORREGIR = { nouns: { 'год': o => { Object.assign(o, { pl_nom: "го'ды, лета'", pl_gen: "лет, годо'в", pl_dat: "года'м", pl_acc: "го'ды", pl_inst: "года'ми", pl_prep: "года'х" }); } } };

// Posesivos que faltan en el origen (наш, ваш), con la misma estructura que мой.
function posesivo(b, a) {
  const f = (m, fe, n, pl) => ({ m, f: fe, n, pl });
  const t = f(
    [a, b + "его", b + "ему", a + ", " + b + "его", b + "им", b + "ем"],
    [b + "а", b + "ей", b + "ей", b + "у", b + "ей, " + b + "ею", b + "ей"],
    [b + "е", b + "его", b + "ему", b + "е", b + "им", b + "ем"],
    [b + "и", b + "их", b + "им", b + "и, " + b + "их", b + "ими", b + "их"]);
  const o = { bare: a.replace(/'/g, ''), accented: a, translations_en: a.startsWith('н') ? 'our, ours' : 'your, yours (formal or plural)' };
  for (const g in t) ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'].forEach((c, k) => o['decl_' + g + '_' + c] = t[g][k]);
  return o;
}
const EXTRA = { adjectives: [posesivo("на'ш", "наш"), posesivo("ва'ш", "ваш")] };
const TRADUCCION = { verbs: { 'нашить': 'sew on', 'говорить': 'speak, talk, say' } };

const datos = {}; const formas = new Map();
for (const t in tablas) {
  datos[t] = leer(t);
  if (EXTRA[t]) datos[t].splice(60, 0, ...EXTRA[t]);
  datos[t].forEach((o, i) => {
    CORREGIR[t]?.[o.bare]?.(o);
    if (TRADUCCION[t]?.[o.bare]) o.translations_en = TRADUCCION[t][o.bare];
    for (const f of [o.bare, ...tablas[t].campos.flatMap(c => (o[c] || '').split(', '))]) {
      if (!f) continue;
      const k = desnudo(f);
      if (!formas.has(k)) formas.set(k, []);
      formas.get(k).push([t, i]);
    }
  });
}

// Palabras del curso: todo el cirílico de index.html.
const html = readFileSync(RAIZ + 'index.html', 'utf8').replace(/́/g, '');
const delCurso = new Set((html.match(/[а-яё]+(?:-[а-яё]+)?/gi) || []).map(desnudo));
const elegidos = {}; for (const t in tablas) elegidos[t] = new Set(datos[t].slice(0, TOPE[t]).map((_, i) => i));
let enCurso = 0;
for (const w of delCurso) for (const [t, i] of formas.get(w) || []) { if (!elegidos[t].has(i)) enCurso++; elegidos[t].add(i); }

// Cada forma se guarda como «cuántas letras comparte con el lema» + el resto: делега'ции → "8ции".
function comprimir(f, lema) {
  let p = 0; while (p < f.length && p < lema.length && f[p] === lema[p]) p++;
  return p >= 3 ? p + f.slice(p) : f;
}
const salida = { ver: 1, fuente: 'OpenRussian.org (Wiktionary + Tatoeba), CC BY-SA 4.0' };
const clave = { nouns: 'n', adjectives: 'a', verbs: 'v', others: 'o' };
for (const t in tablas) {
  salida[clave[t]] = [...elegidos[t]].sort((a, b) => a - b).map(i => {
    const o = datos[t][i];
    const lema = o.accented;
    const f = tablas[t].fila(o).concat(tablas[t].campos.map(c => (o[c] || '').split(', ').map(x => comprimir(x, lema)).join(', ')));
    while (f.length && f[f.length - 1] === '') f.pop();
    return f;
  });
}
const js = '// Generado por scripts/lexico.mjs. Datos: OpenRussian.org, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).\n'
  + 'window.LEXICO = ' + JSON.stringify(salida) + ';\n';
writeFileSync(RAIZ + 'lexico.js', js);
console.log('lexico.js', (js.length / 1024).toFixed(0) + ' KB', Object.fromEntries(Object.entries(clave).map(([t, k]) => [t, salida[k].length])), 'añadidas por el curso:', enCurso);
