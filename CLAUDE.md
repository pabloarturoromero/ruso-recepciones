# Ruso para Recepciones Diplomáticas: procedimiento de cambios

Toda la aplicación es un solo archivo, `index.html`. Los 30 días viven en la constante `DAYS` del `<script>`; la referencia gramatical está escrita en el HTML de `#view-referencia`; el asistente del curso, en la constante `CURSO` y la pestaña `#view-curso`.

## Publicación automática

Cloudflare Pages (proyecto `ruso-recepciones`) está conectado a este repositorio. Cada push a `main` publica en https://ruso-recepciones.pages.dev en uno o dos minutos. Sin comando de compilación; directorio de salida `/`. No se usa Wrangler.

## Flujo para cada cambio

1. Partir de `main` actualizado.
2. Editar `index.html`.
3. Validar: `npm install` (una vez) y `npm test`. Las pruebas de Playwright (`tests/ui.test.mjs` y `tests/sync.test.mjs`) cubren carga sin errores, los 30 días, persistencia, simulaciones, índice, referencia, ancho móvil de 375 px, la pestaña Curso (20 lecciones, ejercicios, persistencia y fusión) y la sincronización entre dos dispositivos.
4. Commit en español y `git push origin main`.
5. Republicar el artifact https://claude.ai/artifact/9QcW1Uue7FqVR2QFo3QzwL con el mismo contenido para que ambas versiones coincidan.

## Datos del usuario

El progreso se guarda en el `localStorage` del navegador con la clave `ruso_recepciones_v2` (`progress`, `perf`, `selectedDay`, `curso`, `cursoSel`). No cambiar la clave ni la estructura sin migrar los datos existentes.

## Sincronización entre dispositivos

El avance (`progress`, `perf` y `curso`; no `selectedDay` ni `cursoSel`) se sincroniza en el documento `ruso/progreso` de la nube propia del recetario Amor de Mamá (`https://recetario-intercambiable.pages.dev/api`, repositorio `recetario`), con la misma clave personal: `Authorization: Bearer <clave>`, versión y 409 ante escrituras atrasadas. Esa nube permite CORS solo a `ruso-recepciones.pages.dev` y sus vistas previas; si se cambia el dominio de esta app, hay que añadirlo allí (`ORIGENES_NUBE` o el patrón del middleware). La clave se guarda en `ruso_recepciones_clave`; el enlace `#nube=<clave>` conecta otro dispositivo y se borra al leerse. `fusionar(base, local, remoto)` combina casilla por casilla con lo último visto en la nube (`ruso_recepciones_base`): lo marcado o desmarcado en cada dispositivo se conserva. Se sube a los 400 ms de cada cambio y se consulta cada 15 s mientras la app está a la vista, y al volver a ella. Dentro del artifact de Claude se usa su base (capacidad `db`, mismo documento `ruso/progreso`), que no se comparte con el sitio publicado. Lo que llega de otro dispositivo se pinta sin reconstruir la lección (`refrescarVista`), para no cortar temporizadores ni lo que se está escribiendo.

## Pestaña Curso (asistente de Russian Enthusiast)

Acompaña las 20 lecciones gratuitas de https://russianenthusiast.com/russian-course/ (4 unidades), empezando por la 1. El texto del curso no se copia: cada lección enlaza la original en inglés (`en`, slug de `/russian-course/`) y en francés (`fr`, slug de `/fr/cours-de-russe/`) y añade material propio: resumen en español (`res`, con tabla opcional `tabla`), videos de YouTube en español (`vid`: id, título, canal y duración; se insertan desde youtube-nocookie solo al pulsar «Ver video»), ejercicios que se corrigen solos (`ej`: `op` con opciones `o` y la correcta en `a`, o `es` para escribir, con respuestas aceptadas en `a` sin acentos ni ё) y una lectura A2 de tema general (`lec`: título, párrafos, traducción, vocabulario y preguntas de comprensión). `dias` enlaza los días del plan de 30 días que trabajan lo mismo.

El avance está en `state.curso[n] = {L, V, E, R}` (lección leída, video visto, ejercicios, lectura). E y R se marcan solos cuando todas las respuestas del bloque son correctas; las respuestas no se guardan. Para un video nuevo, comprobar que esté en español y que permita insertarse (`https://www.youtube.com/oembed?url=…` responde 200). Los acentos van marcados con U+0301.
