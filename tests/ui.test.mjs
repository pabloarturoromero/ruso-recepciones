// Pruebas de interfaz con Playwright: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const URL_APP = 'file://' + RAIZ + 'index.html';
const CAPTURAS = RAIZ + 'capturas/';
const EJECUTABLE = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

let navegador;

before(async () => {
  navegador = await chromium.launch(EJECUTABLE ? { executablePath: EJECUTABLE } : {});
  mkdirSync(CAPTURAS, { recursive: true });
});
after(async () => { await navegador?.close(); });

// Abre la app en un contexto limpio; las fuentes externas se bloquean para no depender de la red.
async function abrir(opciones = {}) {
  const contexto = await navegador.newContext(opciones);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  await pagina.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await pagina.goto(URL_APP);
  return { contexto, pagina, errores };
}

test('carga sin errores y muestra el dashboard vacío', async () => {
  const { contexto, pagina, errores } = await abrir();
  assert.equal(await pagina.title(), 'Ruso Recepciones — Tracker');
  assert.equal(await pagina.locator('.tab-btn').count(), 5);
  assert.equal(await pagina.textContent('#st-curso'), '0/20');
  assert.ok(await pagina.locator('#view-dashboard').isVisible());
  assert.equal(await pagina.textContent('#st-days'), '0/30');
  assert.equal(await pagina.textContent('#st-mock'), '0/4');
  assert.equal(await pagina.locator('#dash-phases .idx-phase').count(), 5);
  await pagina.screenshot({ path: CAPTURAS + '1-dashboard.png', fullPage: true });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('los 30 días se renderizan sin errores', async () => {
  const { contexto, pagina, errores } = await abrir();
  await pagina.click('.tab-btn[data-view="hoy"]');
  assert.equal(await pagina.locator('#day-select option').count(), 30);
  for (let d = 1; d <= 30; d++) {
    await pagina.selectOption('#day-select', String(d));
    const titulo = await pagina.textContent('#hoy-content .day-header h2');
    assert.match(titulo, new RegExp('^Día ' + d + '\\b'), 'título del día ' + d);
    assert.ok(await pagina.locator('#btn-mark-recorded').isVisible(), 'botón de grabación en día ' + d);
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('completar los bloques del día 1 actualiza el progreso y persiste', async () => {
  const { contexto, pagina } = await abrir();
  await pagina.click('.tab-btn[data-view="hoy"]');
  await pagina.selectOption('#day-select', '1');
  for (const b of ['A', 'B', 'C', 'D']) await pagina.check('input[data-block="' + b + '"]');
  await pagina.click('#btn-mark-recorded');
  assert.match(await pagina.textContent('#btn-mark-recorded'), /Grabado/);
  await pagina.screenshot({ path: CAPTURAS + '2-hoy-dia1.png', fullPage: false });

  await pagina.reload();
  await pagina.click('.tab-btn[data-view="dashboard"]');
  assert.equal(await pagina.textContent('#st-days'), '1/30');
  assert.equal(await pagina.textContent('#st-rec'), '1');
  assert.equal(await pagina.textContent('#st-pct'), '3%');
  await contexto.close();
});

test('la clave del ejercicio se muestra y se oculta', async () => {
  const { contexto, pagina } = await abrir();
  await pagina.click('.tab-btn[data-view="hoy"]');
  await pagina.selectOption('#day-select', '1');
  const boton = pagina.locator('.reveal-btn').first();
  const contenido = pagina.locator('.reveal-content').first();
  assert.equal(await contenido.isVisible(), false);
  await boton.click();
  assert.ok(await contenido.isVisible());
  assert.match(await boton.textContent(), /Ocultar/);
  await boton.click();
  assert.equal(await contenido.isVisible(), false);
  await contexto.close();
});

test('los días de simulación muestran el registro de desempeño', async () => {
  const { contexto, pagina } = await abrir();
  await pagina.click('.tab-btn[data-view="hoy"]');
  for (const d of ['7', '14', '21', '28']) {
    await pagina.selectOption('#day-select', d);
    assert.equal(await pagina.locator('[data-perf]').count(), 5, 'campos de desempeño en día ' + d);
  }
  await pagina.fill('[data-perf="latencia"]', '1.8');
  await pagina.reload();
  await pagina.click('.tab-btn[data-view="hoy"]');
  assert.equal(await pagina.inputValue('[data-perf="latencia"]'), '1.8');
  await contexto.close();
});

test('el índice y los enlaces de la referencia llevan al día correcto', async () => {
  const { contexto, pagina } = await abrir();
  await pagina.click('.tab-btn[data-view="indice"]');
  assert.equal(await pagina.locator('.idx-row').count(), 30);
  await pagina.screenshot({ path: CAPTURAS + '3-indice.png', fullPage: true });
  await pagina.click('.idx-row[data-day="12"]');
  assert.ok(await pagina.locator('#view-hoy').isVisible());
  assert.equal(await pagina.inputValue('#day-select'), '12');

  await pagina.click('.tab-btn[data-view="referencia"]');
  await pagina.screenshot({ path: CAPTURAS + '4-referencia.png', fullPage: true });
  await pagina.locator('.ref-block .jumplink[data-day="9"]').first().click();
  assert.equal(await pagina.inputValue('#day-select'), '9');
  await contexto.close();
});

test('en móvil (375 px) no hay desplazamiento horizontal', async () => {
  const { contexto, pagina } = await abrir({ viewport: { width: 375, height: 812 }, isMobile: true });
  for (const vista of ['dashboard', 'hoy', 'indice', 'referencia', 'curso']) {
    await pagina.click('.tab-btn[data-view="' + vista + '"]');
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(ancho <= 376, vista + ': ancho ' + ancho);
  }
  await pagina.click('.tab-btn[data-view="hoy"]');
  await pagina.screenshot({ path: CAPTURAS + '5-movil-hoy.png', fullPage: false });
  await pagina.click('.tab-btn[data-view="curso"]');
  await pagina.screenshot({ path: CAPTURAS + '7-movil-curso.png', fullPage: true });
  await contexto.close();
});

// Responde bien todos los ejercicios de un grupo leyendo la clave del bloque CURSO.
async function responderTodo(pagina, grupo) {
  const claves = await pagina.evaluate(g => {
    const L = CURSO.lecciones[state.cursoSel];
    return (g === 'e' ? L.ej : L.lec.pr).map(e => e.t === 'op' ? { op: e.a } : { es: e.a[0] });
  }, grupo);
  for (let i = 0; i < claves.length; i++) {
    const li = pagina.locator('.cu-ej[data-g="' + grupo + '"][data-i="' + i + '"]');
    if (claves[i].op !== undefined) await li.locator('.cu-op[data-o="' + claves[i].op + '"]').click();
    else { await li.locator('input').fill(claves[i].es.toUpperCase() + '.'); await li.locator('button[type="submit"]').click(); }
  }
}

test('el curso: 20 lecciones en orden, cada una con resumen, videos, ejercicios y lectura', async () => {
  const { contexto, pagina, errores } = await abrir();
  await pagina.click('.tab-btn[data-view="curso"]');
  assert.equal(await pagina.locator('#curso-select option').count(), 20);
  assert.equal(await pagina.inputValue('#curso-select'), '1');
  assert.equal(await pagina.locator('.cu-chip').count(), 20);
  await pagina.screenshot({ path: CAPTURAS + '6-curso.png', fullPage: true });
  for (let n = 1; n <= 20; n++) {
    await pagina.selectOption('#curso-select', String(n));
    assert.match(await pagina.textContent('#curso-content .day-header h2'), new RegExp('^Lección ' + n + ' '));
    assert.ok(await pagina.locator('[data-vid]').count() >= 1, 'videos en la lección ' + n);
    assert.ok(await pagina.locator('.cu-ej[data-g="e"]').count() >= 8, 'ejercicios en la lección ' + n);
    assert.ok(await pagina.locator('.cu-ej[data-g="p"]').count() >= 3, 'comprensión en la lección ' + n);
    assert.ok((await pagina.textContent('.cu-lec')).length > 150, 'lectura en la lección ' + n);
    const enlace = await pagina.getAttribute('.cu-links a', 'href');
    assert.match(enlace, new RegExp('^https://russianenthusiast\\.com/russian-course/lesson-' + n + '-'));
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('el curso: ejercicios corregidos, pasos marcados y persistencia', async () => {
  const { contexto, pagina, errores } = await abrir();
  await pagina.click('.tab-btn[data-view="curso"]');
  // Una respuesta equivocada no marca nada y se puede corregir.
  const ej = await pagina.evaluate(() => CURSO.lecciones[1].ej.findIndex(e => e.t === 'op'));
  const mala = await pagina.evaluate(i => (CURSO.lecciones[1].ej[i].a + 1) % CURSO.lecciones[1].ej[i].o.length, ej);
  await pagina.locator('.cu-ej[data-g="e"][data-i="' + ej + '"] .cu-op[data-o="' + mala + '"]').click();
  assert.match(await pagina.textContent('.cu-ej[data-g="e"][data-i="' + ej + '"] .cu-fb'), /Todavía no/);
  await responderTodo(pagina, 'e');
  assert.ok(await pagina.isChecked('input[data-paso="E"]'), 'paso de ejercicios marcado solo');
  assert.equal(await pagina.textContent('#cu-score-e'), '10/10');
  await responderTodo(pagina, 'p');
  assert.ok(await pagina.isChecked('input[data-paso="R"]'), 'paso de lectura marcado solo');
  await pagina.check('input[data-paso="L"]');
  await pagina.check('input[data-paso="V"]');
  assert.equal(await pagina.textContent('#cu-hechas'), '1/20');
  assert.equal(await pagina.getAttribute('.cu-chip[data-l="1"] .status-dot', 'class'), 'status-dot done');

  // El video se inserta solo al pulsar, desde youtube-nocookie.
  await pagina.route(/youtube-nocookie\.com/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>video</p>' }));
  await pagina.locator('[data-vid]').first().click();
  assert.match(await pagina.getAttribute('.cu-frame iframe', 'src'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/K0hE_WPQEVk/);

  await pagina.click('.cu-nav [data-ir="2"]');
  assert.equal(await pagina.inputValue('#curso-select'), '2');
  await pagina.reload();
  assert.equal(await pagina.textContent('#st-curso'), '1/20');
  await pagina.click('.tab-btn[data-view="curso"]');
  assert.equal(await pagina.inputValue('#curso-select'), '2');
  await pagina.click('#curso-pend');
  assert.equal(await pagina.inputValue('#curso-select'), '2');
  await pagina.selectOption('#curso-select', '1');
  for (const k of ['L', 'V', 'E', 'R']) assert.ok(await pagina.isChecked('input[data-paso="' + k + '"]'), 'paso ' + k + ' tras recargar');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('la fusión entre dispositivos conserva los pasos del curso', async () => {
  const { contexto, pagina } = await abrir();
  const r = await pagina.evaluate(() => {
    const base = { progress: {}, perf: {}, curso: { 3: { L: true } } };
    const local = { progress: { 1: { A: true } }, perf: {}, curso: { 3: { L: true, V: true } } };
    const remoto = { progress: {}, perf: {}, curso: { 3: { L: false }, 5: { E: true } } };
    return fusionar(base, local, remoto);
  });
  assert.deepEqual(r.curso, { 3: { L: false, V: true, E: false, R: false }, 5: { L: false, V: false, E: true, R: false } });
  assert.equal(r.progress[1].A, true);
  await contexto.close();
});
