# Ruso para Recepciones Diplomáticas: procedimiento de cambios

Toda la aplicación es un solo archivo, `index.html`. Los 30 días viven en la constante `DAYS` del `<script>`; la referencia gramatical está escrita en el HTML de `#view-referencia`; el asistente del curso, en la constante `CURSO` y la pestaña `#view-curso`.

La pestaña «Dudas» (`#view-dudas`) es un chat sin red ni modelos de lenguaje. Los temas (gramática, ortografía, pronunciación, fórmulas, método) viven en el bloque JSON `<script type="application/json" id="dudas">`: cada tema tiene `id`, `t` (título), `dice` (frases que lo activan, sin tildes; se comparan como palabras completas), `r` (respuesta en HTML, con comillas simples en los atributos) y `dias`. El motor está en `<script id="dudas-motor">` (`crearDudas`). El diccionario es `lexico.js`, generado con `node scripts/lexico.mjs <carpeta de los CSV de OpenRussian>`; se carga solo al abrir la pestaña y debe publicarse junto a `index.html`. Si se añade vocabulario ruso al plan, regenerar `lexico.js` para que el chat lo reconozca. Los datos son CC BY-SA 4.0: conservar la atribución de la pestaña.

El vocabulario del repaso espaciado está en el bloque JSON `<script type="application/json" id="vocab">` (mazos con `id`, `ru` con tilde de acento U+0301, `es`, y opcionalmente `lee`, `nota` y `dia`). Los ids son también el GUID de Anki (`rr-<id>`): no renombrarlos, o Anki duplicará las notas. Los escenarios del simulador están en `<script type="application/json" id="escenarios">`; cada respuesta modelo lleva `ids` de frases del vocabulario (la prueba falla si alguno no existe) y puede llevar `sigue` para ramificar. La lógica (programador SM-2, grabadora, simulador, diagnóstico, Anki y tarjeta de bolsillo) está en `<script id="repaso">`.

## Publicación automática

Cloudflare Pages (proyecto `ruso-recepciones`) está conectado a este repositorio. Cada push a `main` publica en https://ruso-recepciones.pages.dev en uno o dos minutos. Sin comando de compilación; directorio de salida `/`. No se usa Wrangler.

## Flujo para cada cambio

1. Partir de `main` actualizado.
2. Editar `index.html`.
3. Validar: `npm install` (una vez) y `npm test`. `tests/dudas.test.mjs` prueba el motor del chat; las pruebas de Playwright (`tests/ui.test.mjs` y `tests/sync.test.mjs`) cubren carga sin errores, los 30 días, persistencia, simulaciones, índice, referencia, ancho móvil de 375 px, la pestaña Curso (20 lecciones, ejercicios, persistencia y fusión), el chat de dudas y la sincronización entre dos dispositivos.
4. Commit en español y `git push origin main`.
5. Republicar el artifact https://claude.ai/artifact/9QcW1Uue7FqVR2QFo3QzwL con el mismo contenido para que ambas versiones coincidan (con `lexico.js` como archivo adjunto en `files`).

## Datos del usuario

El progreso se guarda en el `localStorage` del navegador con la clave `ruso_recepciones_v2` (`progress`, `perf`, `selectedDay`, `curso`, `cursoSel`). El repaso, la pronunciación y las simulaciones van aparte, en `ruso_recepciones_repaso_v1` (`v: 1`, `cards`, `log`, `nuevas`, `pron`, `sim`, `forzar`, `ajustes`), que por ahora no se sincroniza. No cambiar las claves ni la estructura sin migrar los datos existentes. Las grabaciones de voz no se guardan: viven solo en memoria.

## Sincronización entre dispositivos

El avance (`progress`, `perf` y `curso`; no `selectedDay` ni `cursoSel`) se sincroniza en el documento `ruso/progreso` de la nube propia del recetario Amor de Mamá (`https://recetario-intercambiable.pages.dev/api`, repositorio `recetario`), con la misma clave personal: `Authorization: Bearer <clave>`, versión y 409 ante escrituras atrasadas. Esa nube permite CORS solo a `ruso-recepciones.pages.dev` y sus vistas previas; si se cambia el dominio de esta app, hay que añadirlo allí (`ORIGENES_NUBE` o el patrón del middleware). La clave se guarda en `ruso_recepciones_clave`; el enlace `#nube=<clave>` conecta otro dispositivo y se borra al leerse. `fusionar(base, local, remoto)` combina casilla por casilla con lo último visto en la nube (`ruso_recepciones_base`): lo marcado o desmarcado en cada dispositivo se conserva. Se sube a los 400 ms de cada cambio y se consulta cada 15 s mientras la app está a la vista, y al volver a ella. Dentro del artifact de Claude se usa su base (capacidad `db`, mismo documento `ruso/progreso`), que no se comparte con el sitio publicado. Lo que llega de otro dispositivo se pinta sin reconstruir la lección (`refrescarVista`), para no cortar temporizadores ni lo que se está escribiendo.

## Pestaña Curso (asistente de Russian Enthusiast)

Acompaña las 20 lecciones gratuitas de https://russianenthusiast.com/russian-course/ (4 unidades), empezando por la 1. El texto del curso no se copia: cada lección enlaza la original en inglés (`en`, slug de `/russian-course/`) y en francés (`fr`, slug de `/fr/cours-de-russe/`) y añade material propio: resumen en español (`res`, con tabla opcional `tabla`), videos de YouTube en español (`vid`: id, título, canal y duración; se insertan desde youtube-nocookie solo al pulsar «Ver video»), ejercicios que se corrigen solos (`ej`: `op` con opciones `o` y la correcta en `a`, o `es` para escribir, con respuestas aceptadas en `a` sin acentos ni ё) y una lectura A2 de tema general (`lec`: título, párrafos, traducción, vocabulario y preguntas de comprensión). `dias` enlaza los días del plan de 30 días que trabajan lo mismo.

El avance está en `state.curso[n] = {L, V, E, R}` (lección leída, video visto, ejercicios, lectura). E y R se marcan solos cuando todas las respuestas del bloque son correctas; las respuestas no se guardan. Para un video nuevo, comprobar que esté en español y que permita insertarse (`https://www.youtube.com/oembed?url=…` responde 200). Los acentos van marcados con U+0301.
