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
  assert.equal(await pagina.locator('.tab-btn').count(), 6);
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
  for (const vista of ['dashboard', 'hoy', 'repaso', 'simulador', 'indice', 'referencia']) {
    await pagina.click('.tab-btn[data-view="' + vista + '"]');
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(ancho <= 376, vista + ': ancho ' + ancho);
  }
  await pagina.click('.tab-btn[data-view="hoy"]');
  await pagina.screenshot({ path: CAPTURAS + '5-movil-hoy.png', fullPage: false });
  await contexto.close();
});

test('el vocabulario es válido: ids únicos, ruso con cirílico y español', async () => {
  const { contexto, pagina, errores } = await abrir();
  const r = await pagina.evaluate(() => {
    const ids = [];
    VOCAB.mazos.forEach(m => m.items.forEach(it => ids.push(it.id)));
    const malos = VOCAB.mazos.flatMap(m => m.items).filter(it => !/[а-яё]/i.test(it.ru) || !it.es).map(it => it.id);
    const refs = ESC.escenarios.flatMap(e => e.turnos.flatMap(t => t.pool.flatMap(p => p.resp.flatMap(r => (r.ids || []).concat(r.sigue ? r.sigue.resp.flatMap(x => x.ids || []) : [])))))
      .concat(ESC.complicaciones.flatMap(c => c.resp.flatMap(r => r.ids || [])));
    return { total: ids.length, unicos: new Set(ids).size, malos, rotas: refs.filter(id => !ITEMS[id]), mazos: VOCAB.mazos.map(m => m.id) };
  });
  assert.equal(r.total, r.unicos, 'ids repetidos');
  assert.ok(r.total >= 250, 'frases: ' + r.total);
  assert.deepEqual(r.malos, []);
  assert.deepEqual(r.rotas, [], 'ids de escenarios sin frase');
  for (const m of ['plan', 'basico', 'numeros', 'dias', 'meses', 'horas', 'colores', 'comida', 'diplo', 'antartida', 'muletillas']) assert.ok(r.mazos.includes(m), m);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('el programador espacia las repeticiones', async () => {
  const { contexto, pagina } = await abrir();
  const r = await pagina.evaluate(() => {
    const now = new Date(2026, 8, 29, 10).getTime();
    const a = programar(null, 3, now);          // paso 1 → 10 min
    const b = programar(a, 3, now + 600000);    // gradúa → 1 día
    const c = programar(b, 3, b.due);           // ~2,5 días
    const f = programar(c, 1, c.due);           // olvido → reaprendizaje
    const facil = programar(null, 4, now);
    return { a: [a.ivl, a.due - now], b: b.ivl, c: c.ivl, f: [f.ivl, f.lapses, f.rel], facil: facil.ivl };
  });
  assert.deepEqual(r.a, [0, 600000]);
  assert.equal(r.b, 1);
  assert.ok(r.c >= 2 && r.c <= 3, 'intervalo ' + r.c);
  assert.deepEqual(r.f, [0, 1, true]);
  assert.equal(r.facil, 4);
  await contexto.close();
});

test('repaso: mostrar, calificar y persistir', async () => {
  const { contexto, pagina, errores } = await abrir();
  await pagina.click('.tab-btn[data-view="repaso"]');
  assert.equal(await pagina.textContent('#rp-nuevas'), '15');
  await pagina.click('#rp-empezar');
  await pagina.click('#fc-mostrar');
  assert.ok(await pagina.locator('.fc-ru').isVisible());
  assert.equal(await pagina.locator('[data-grade]').count(), 4);
  await pagina.locator('.seg[data-crit="a"] button[data-v="2"]').click();
  await pagina.screenshot({ path: CAPTURAS + '6-repaso.png', fullPage: false });
  await pagina.click('[data-grade="3"]');
  await pagina.keyboard.press('Space');
  await pagina.keyboard.press('4');
  assert.equal(await pagina.textContent('#rp-nuevas'), '13');
  await pagina.reload();
  const guardado = await pagina.evaluate(() => JSON.parse(localStorage.getItem('ruso_recepciones_repaso_v1')));
  assert.equal(Object.keys(guardado.cards).length, 2);
  assert.equal(guardado.log.length, 2);
  assert.equal(guardado.pron.p01.a, 2);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('exporta a Anki con encabezados y un renglón por frase', async () => {
  const { contexto, pagina } = await abrir();
  await pagina.click('.tab-btn[data-view="repaso"]');
  const [descarga] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#anki-txt')]);
  assert.equal(descarga.suggestedFilename(), 'ruso-recepciones-anki.txt');
  const texto = await pagina.evaluate(() => textoAnki(VOCAB.mazos));
  const lineas = texto.trim().split('\n');
  assert.equal(lineas[0], '#separator:tab');
  const datos = lineas.filter(l => !l.startsWith('#'));
  const total = await pagina.evaluate(() => ORDEN.length);
  assert.equal(datos.length, total);
  assert.ok(datos.every(l => l.split('\t').length === 5));
  assert.match(datos[0], /^rr-p01\t/);
  assert.match(datos[0], /Ruso Recepciones::Frases del plan/);
  await contexto.close();
});

test('simulador: recorre una recepción completa y guarda el resultado', async () => {
  const { contexto, pagina, errores } = await abrir();
  await pagina.addInitScript(() => { try { delete window.speechSynthesis; } catch (e) {} });
  await pagina.reload();
  await pagina.click('.tab-btn[data-view="simulador"]');
  assert.equal(await pagina.locator('.esc-opt').count(), 5);
  await pagina.click('.esc-opt[data-esc="rcta"]');
  await pagina.click('#sim-empezar');
  for (let i = 0; i < 20; i++) {
    if (await pagina.locator('#sim-a-repaso, #sim-otra').count()) break;
    await pagina.locator('#sim-hablo').click();
    if (i === 0) await pagina.screenshot({ path: CAPTURAS + '7-simulador.png', fullPage: false });
    await pagina.locator(i % 3 === 2 ? '[data-nota="fallo"]' : '[data-nota="bien"]').click();
  }
  assert.ok(await pagina.locator('#sim-otra').isVisible());
  await pagina.click('#sim-guardar-dia');
  const r = await pagina.evaluate(() => ({ sim: R.sim.length, perf: state.perf[7] }));
  assert.equal(r.sim, 1);
  assert.ok(r.perf && r.perf.silencios !== undefined);
  if (await pagina.locator('#sim-a-repaso').count()) {
    await pagina.click('#sim-a-repaso');
    assert.ok(await pagina.locator('#view-repaso').isVisible());
    assert.match(await pagina.textContent('.fc-meta'), /refuerzo/);
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('diagnóstico, material dirigido del día 20 y tarjeta de bolsillo', async () => {
  const { contexto, pagina, errores } = await abrir();
  await pagina.evaluate(() => {
    const now = Date.now();
    ['p20', 'p21', 'u03'].forEach(id => { let c = programar(null, 4, now - 10 * 86400000); c = programar(c, 1, now - 86400000); R.cards[id] = c; R.log.push({ t: now - 86400000, id, g: 1 }); });
    R.pron.p01 = { a: 1, r: 3, f: 2 };
    guardarRepaso();
  });
  await pagina.reload();
  assert.match(await pagina.textContent('#dash-diag'), /acento/i);
  assert.ok(await pagina.locator('#dash-diag [data-repasar]').isVisible());
  await pagina.click('.tab-btn[data-view="hoy"]');
  await pagina.selectOption('#day-select', '20');
  assert.ok(await pagina.locator('.diag-hoy').isVisible());
  await pagina.selectOption('#day-select', '30');
  await pagina.locator('#hoy-content [data-tarjeta]').click();
  assert.ok(await pagina.locator('#tarjeta .tj').isVisible());
  assert.equal(await pagina.locator('#tarjeta li').count() >= 12, true);
  await pagina.screenshot({ path: CAPTURAS + '8-tarjeta.png', fullPage: false });
  await pagina.click('#tj-cerrar');
  assert.equal(await pagina.locator('#tarjeta').isVisible(), false);
  assert.deepEqual(errores, []);
  await contexto.close();
});
