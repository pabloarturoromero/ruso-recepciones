// Pruebas del motor de «Dudas» (sin navegador): node --test tests/dudas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(RAIZ + 'index.html', 'utf8');
const bloque = id => html.match(new RegExp('<script[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</script>'))[1];
const DAYS = JSON.parse(html.match(/const DAYS = (\{.*\});\n/)[1]);
const temas = JSON.parse(bloque('dudas')).temas;
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(bloque('dudas-motor'), ctx);
vm.runInContext(readFileSync(RAIZ + 'lexico.js', 'utf8'), ctx);

function nuevo(pendiente = 4) {
  const m = ctx.window.crearDudas(temas, DAYS, { primerPendiente: () => pendiente });
  m.cargarLexico(ctx.window.LEXICO);
  return m;
}
const M = nuevo();
const texto = q => M.responder(q).html.replace(/<[^>]+>/g, ' ').replace(/́/g, '').replace(/\s+/g, ' ');

test('los temas tienen id único, título, frases y respuesta', () => {
  const ids = new Set();
  for (const t of temas) {
    assert.ok(t.id && t.t && t.r && t.dice.length, 'tema incompleto: ' + t.id);
    assert.ok(!ids.has(t.id), 'id repetido: ' + t.id); ids.add(t.id);
    for (const d of t.dias || []) assert.ok(DAYS[String(d)], t.id + ': día inexistente ' + d);
  }
});

test('el diccionario trae las palabras del curso con acento', () => {
  const L = ctx.window.LEXICO;
  assert.ok(L.n.length > 2000 && L.v.length > 1500 && L.a.length > 900);
  const lemas = new Set([...L.n, ...L.a, ...L.v, ...L.o].map(f => f[0].replace(/'/g, '')));
  for (const w of ['делегация', 'приглашение', 'сотрудничество', 'говорить', 'наш', 'ваш', 'спасибо', 'давно', 'Россия']) assert.ok(lemas.has(w), 'falta ' + w);
});

test('caso pedido explícitamente y por preposición', () => {
  assert.match(texto('genitivo de Россия'), /genitivo singular: Росcии|genitivo singular: России/);
  assert.match(texto('из Аргентина'), /из \+ genitivo: из Аргентины/);
  assert.match(texto('от имени наша делегация'), /от имени нашей делегации/);
  assert.match(texto('за наши страны'), /за \+ acusativo: за наши страны/);
  assert.match(texto('в Москва'), /в Москве/);
  assert.match(texto('в Москва'), /в Москву/);
  assert.match(texto('dativo plural de наш друг'), /нашим друзьям/);
});

test('seguimiento de la conversación: «¿y el plural?»', () => {
  const m = nuevo();
  m.responder('genitivo de год');
  assert.match(m.responder('¿y el plural?').html.replace(/́/g, ''), /годы/);
});

test('verbos: conjugación, aspecto y pasado', () => {
  const c = texto('conjuga говорить');
  for (const f of ['говорю', 'говоришь', 'говорят', 'говорил']) assert.ok(c.includes(f), f);
  assert.match(texto('aspecto de сказать'), /perfectivo/);
  assert.match(texto('aspecto de сказать'), /говорить/);
  assert.match(texto('pasado de понять'), /поняла/);
});

test('una forma flexionada se reconoce y se nombra', () => {
  assert.match(texto('делегации'), /genitivo singular/);
  assert.match(texto('делегации'), /делегация/);
});

test('acento y aparición en el curso', () => {
  const t = texto('acento de приглашение');
  assert.match(t, /sílaba 3 de 5/);
  assert.match(t, /En el curso/);
  assert.match(M.responder('acento de приглашение').html, /class="jumplink" data-day="6"/);
});

test('transliteración latina', () => {
  assert.match(texto('spasibo'), /спасибо/);
  assert.match(texto('genitivo de rossiya'), /России/);
  assert.match(texto('plural de god'), /годы/);
});

test('temas de gramática y ortografía', () => {
  assert.match(texto('¿-тся o -ться?'), /-тся o -ться/);
  assert.match(texto('¿por qué конечно suena con ш?'), /ч suena \[sh\]/);
  assert.match(texto('mayúsculas en un oficio'), /Mayúsculas/);
  assert.match(texto('¿cuándo se escribe ы?'), /Siete letras/);
  assert.match(texto('qué caso va después de из'), /genitivo/i);
  assert.match(texto('consejos'), /Consejos de estudio/);
});

test('preguntas sobre el curso', () => {
  assert.match(texto('día 12'), /Día 12 — Nombres, patronímicos/);
  assert.match(texto('¿qué toca hoy?'), /primer día pendiente es el 4/);
  assert.match(texto('cómo se dice con mucho gusto'), /удовольствием/);
});

test('sin respuesta: no inventa y ofrece alternativas', () => {
  const t = texto('el significado de la vida');
  assert.match(t, /No tengo una respuesta preparada/);
  const m = nuevo();
  assert.match(m.responder('genitivo de ыыыы').html, /No encuentro/);
});

test('escapa lo que escribe la persona', () => {
  const h = M.responder('<img src=x onerror=alert(1)> делегации').html;
  assert.ok(!h.includes('<img'));
});
