# Ruso para Recepciones Diplomáticas: procedimiento de cambios

Toda la aplicación es un solo archivo, `index.html`. Los 30 días viven en la constante `DAYS` del `<script>`; la referencia gramatical está escrita en el HTML de `#view-referencia`.

La pestaña «Dudas» (`#view-dudas`) es un chat sin red ni modelos de lenguaje. Los temas (gramática, ortografía, pronunciación, fórmulas, método) viven en el bloque JSON `<script type="application/json" id="dudas">`: cada tema tiene `id`, `t` (título), `dice` (frases que lo activan, sin tildes; se comparan como palabras completas), `r` (respuesta en HTML, con comillas simples en los atributos) y `dias`. El motor está en `<script id="dudas-motor">` (`crearDudas`). El diccionario es `lexico.js`, generado con `node scripts/lexico.mjs <carpeta de los CSV de OpenRussian>`; se carga solo al abrir la pestaña y debe publicarse junto a `index.html`. Si se añade vocabulario ruso al plan, regenerar `lexico.js` para que el chat lo reconozca. Los datos son CC BY-SA 4.0: conservar la atribución de la pestaña.

## Publicación automática

Cloudflare Pages (proyecto `ruso-recepciones`) está conectado a este repositorio. Cada push a `main` publica en https://ruso-recepciones.pages.dev en uno o dos minutos. Sin comando de compilación; directorio de salida `/`. No se usa Wrangler.

## Flujo para cada cambio

1. Partir de `main` actualizado.
2. Editar `index.html`.
3. Validar: `npm install` (una vez) y `npm test`. `tests/dudas.test.mjs` prueba el motor del chat; las pruebas de Playwright (`tests/ui.test.mjs`) cubren carga sin errores, los 30 días, persistencia, simulaciones, índice, referencia, el chat de dudas y ancho móvil de 375 px.
4. Commit en español y `git push origin main`.
5. Republicar el artifact https://claude.ai/artifact/9QcW1Uue7FqVR2QFo3QzwL con el mismo contenido para que ambas versiones coincidan (con `lexico.js` como archivo adjunto en `files`).

## Datos del usuario

El progreso se guarda en el `localStorage` del navegador con la clave `ruso_recepciones_v2` (`progress`, `perf`, `selectedDay`). No cambiar la clave ni la estructura sin migrar los datos existentes.
