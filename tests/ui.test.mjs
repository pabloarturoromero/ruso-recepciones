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
  assert.equal(await pagina.locator('.tab-btn').count(), 4);
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
  for (const vista of ['dashboard', 'hoy', 'indice', 'referencia']) {
    await pagina.click('.tab-btn[data-view="' + vista + '"]');
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(ancho <= 376, vista + ': ancho ' + ancho);
  }
  await pagina.click('.tab-btn[data-view="hoy"]');
  await pagina.screenshot({ path: CAPTURAS + '5-movil-hoy.png', fullPage: false });
  await contexto.close();
});
