# Ruso para Recepciones Diplomáticas: procedimiento de cambios

Toda la aplicación es un solo archivo, `index.html`. Los 30 días viven en la constante `DAYS` del `<script>`; la referencia gramatical está escrita en el HTML de `#view-referencia`.

El vocabulario del repaso espaciado está en el bloque JSON `<script type="application/json" id="vocab">` (mazos con `id`, `ru` con tilde de acento U+0301, `es`, y opcionalmente `lee`, `nota` y `dia`). Los ids son también el GUID de Anki (`rr-<id>`): no renombrarlos, o Anki duplicará las notas. Los escenarios del simulador están en `<script type="application/json" id="escenarios">`; cada respuesta modelo lleva `ids` de frases del vocabulario (la prueba falla si alguno no existe) y puede llevar `sigue` para ramificar. La lógica (programador SM-2, grabadora, simulador, diagnóstico, Anki y tarjeta de bolsillo) está en `<script id="repaso">`.

## Publicación automática

Cloudflare Pages (proyecto `ruso-recepciones`) está conectado a este repositorio. Cada push a `main` publica en https://ruso-recepciones.pages.dev en uno o dos minutos. Sin comando de compilación; directorio de salida `/`. No se usa Wrangler.

## Flujo para cada cambio

1. Partir de `main` actualizado.
2. Editar `index.html`.
3. Validar: `npm install` (una vez) y `npm test`. Las pruebas de Playwright (`tests/ui.test.mjs`) cubren carga sin errores, los 30 días, persistencia, simulaciones, índice, referencia y ancho móvil de 375 px.
4. Commit en español y `git push origin main`.
5. Republicar el artifact https://claude.ai/artifact/9QcW1Uue7FqVR2QFo3QzwL con el mismo contenido para que ambas versiones coincidan.

## Datos del usuario

El progreso se guarda en el `localStorage` del navegador con la clave `ruso_recepciones_v2` (`progress`, `perf`, `selectedDay`). El repaso, la pronunciación y las simulaciones van aparte, en `ruso_recepciones_repaso_v1` (`v: 1`, `cards`, `log`, `nuevas`, `pron`, `sim`, `forzar`, `ajustes`). No cambiar las claves ni la estructura sin migrar los datos existentes. Las grabaciones de voz no se guardan: viven solo en memoria.
