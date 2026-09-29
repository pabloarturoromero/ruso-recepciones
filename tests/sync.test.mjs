// Sincronización entre dispositivos: dos navegadores comparten el avance a través de una nube simulada
// con el mismo contrato que la del recetario (clave Bearer, versión y 409 ante escrituras atrasadas).
// Uso: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const URL_APP = 'file://' + fileURLToPath(new URL('../index.html', import.meta.url));
const EJECUTABLE = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const API = 'https://recetario-intercambiable.pages.dev/api/';
const CLAVE = 'abcde-fghjk-mnpqr-stuvw';

let navegador;
before(async () => { navegador = await chromium.launch(EJECUTABLE ? { executablePath: EJECUTABLE } : {}); });
after(async () => { await navegador?.close(); });

function nube() {
  const n = { doc: null, puts: 0 };
  n.manejar = async (ruta) => {
    const req = ruta.request(), url = req.url().slice(API.length);
    const cors = { 'Access-Control-Allow-Origin': req.headers().origin || '*', 'Vary': 'Origin' };
    const json = (status, cuerpo) => ruta.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(cuerpo) });
    if (req.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: { ...cors,
      'Access-Control-Allow-Methods': 'GET, PUT', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
    if ((req.headers().authorization || '') !== 'Bearer ' + CLAVE) return json(401, { ok: false });
    if (url === 'nube') return json(200, { ok: true });
    if (url !== 'doc/ruso/progreso') return json(404, { ok: false });
    if (req.method() === 'GET') return n.doc ? json(200, { exists: true, ...n.doc }) : json(404, { exists: false });
    const c = JSON.parse(req.postData());
    if (n.doc && n.doc.version !== c.base) return json(409, { conflicto: true, ...n.doc });
    n.puts++;
    n.doc = { version: (n.doc ? n.doc.version : 0) + 1, data: c.data };
    return json(200, { ok: true, version: n.doc.version });
  };
  return n;
}

async function dispositivo(n, clave) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  if (clave) await contexto.addInitScript((c) => { if (!sessionStorage.getItem('k')) { sessionStorage.setItem('k', '1'); localStorage.setItem('ruso_recepciones_clave', c); } }, clave);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  await pagina.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await pagina.route(API + '**', n.manejar);
  await pagina.goto(URL_APP);
  return { contexto, pagina, errores };
}
const sincronizado = (p) => p.waitForFunction(() => document.getElementById('sync-txt').textContent === 'Sincronizado', null, { timeout: 8000 });

test('sin clave: se conecta desde el dashboard, rechaza una clave incorrecta y sube lo local', async () => {
  const n = nube();
  const { contexto, pagina, errores } = await dispositivo(n, null);
  await pagina.click('.tab-btn[data-view="hoy"]');
  await pagina.check('input[data-block="A"]');
  assert.equal(n.puts, 0, 'sin clave no sale nada');
  await pagina.click('.tab-btn[data-view="dashboard"]');
  await pagina.fill('#sync-clave', 'clave-equivocada-de-prueba');
  await pagina.click('#sync-form [type=submit]');
  await pagina.waitForSelector('#sync-card [role=alert] >> text=Clave incorrecta');
  await pagina.fill('#sync-clave', CLAVE);
  await pagina.click('#sync-form [type=submit]');
  await sincronizado(pagina);
  assert.equal(n.doc.data.progress[1].A, true, 'lo hecho antes de conectar se subió');
  assert.match(await pagina.textContent('#sync-card'), /Conectado/);
  const ov = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(ov <= 0, 'sin desborde a 390 px');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('dos dispositivos: lo que marcas en uno aparece solo en el otro y nada se pisa', async () => {
  const n = nube();
  const tel = await dispositivo(n, CLAVE), pc = await dispositivo(n, CLAVE);
  for (const d of [tel, pc]) { await sincronizado(d.pagina); await d.pagina.click('.tab-btn[data-view="hoy"]'); await d.pagina.selectOption('#day-select', '2'); }
  await tel.pagina.check('input[data-block="A"]'); await sincronizado(tel.pagina);
  // La computadora aún no lo ha visto y marca otro bloque: la nube responde 409 y se suman los dos.
  await pc.pagina.check('input[data-block="B"]'); await sincronizado(pc.pagina);
  assert.deepEqual([n.doc.data.progress[2].A, n.doc.data.progress[2].B], [true, true]);
  assert.ok(await pc.pagina.isChecked('input[data-block="A"]'), 'la computadora ya muestra el bloque A del teléfono');
  // Sin tocar nada, la consulta periódica trae el bloque B al teléfono.
  await tel.pagina.waitForFunction(() => document.querySelector('input[data-block="B"]').checked, null, { timeout: 25000 });
  // Al volver a la app, se consulta en el acto.
  await pc.pagina.click('#btn-mark-recorded'); await sincronizado(pc.pagina);
  await tel.pagina.evaluate(() => window.dispatchEvent(new Event('focus')));
  await tel.pagina.waitForFunction(() => /Grabado/.test(document.getElementById('btn-mark-recorded').textContent), null, { timeout: 8000 });
  // Desmarcar en un dispositivo también viaja.
  await tel.pagina.uncheck('input[data-block="A"]'); await sincronizado(tel.pagina);
  await pc.pagina.evaluate(() => window.dispatchEvent(new Event('focus')));
  await pc.pagina.waitForFunction(() => !document.querySelector('input[data-block="A"]').checked, null, { timeout: 8000 });
  await pc.pagina.click('.tab-btn[data-view="dashboard"]');
  assert.equal(await pc.pagina.textContent('#st-rec'), '1');
  assert.deepEqual([...tel.errores, ...pc.errores], []);
  await Promise.all([tel.contexto.close(), pc.contexto.close()]);
});

test('el enlace #nube= conecta otro dispositivo y no deja la clave en la barra', async () => {
  const n = nube();
  n.doc = { version: 3, data: { v: 2, progress: { 5: { A: true, B: true, C: true, D: true, recorded: true } }, perf: {} } };
  const contexto = await navegador.newContext();
  const pagina = await contexto.newPage();
  await pagina.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await pagina.route(API + '**', n.manejar);
  await pagina.goto(URL_APP + '#nube=' + CLAVE);
  await sincronizado(pagina);
  assert.equal(await pagina.evaluate(() => location.hash), '');
  assert.equal(await pagina.textContent('#st-days'), '1/30');
  await contexto.close();
});
