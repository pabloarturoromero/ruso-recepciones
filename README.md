# Ruso para Recepciones Diplomáticas

Plan de 30 días (Rev 2.0) en un solo archivo, `index.html`: dashboard de progreso, lección del día con temporizadores y lectura en voz rusa del navegador, índice de 30 días, referencia gramatical la pestaña Curso, que acompaña las 20 lecciones del curso gratuito de Russian Enthusiast con resúmenes en español, videos, ejercicios autocorregidos y lecturas A2, y la pestaña «Dudas», un chat sin conexión para preguntas de gramática, ortografía, pronunciación y vocabulario. El progreso se guarda en el `localStorage` del navegador (clave `ruso_recepciones_v2`) y, con la clave de sincronización de Amor de Mamá (Dashboard → Sincronización entre dispositivos), se comparte entre el teléfono y la computadora.

## Uso

Publicado en https://ruso-recepciones.pages.dev (Cloudflare Pages, cada push a `main`). También se puede abrir `index.html` directamente en el navegador.

## Pruebas (Playwright)

```
npm install
npm test
```

`tests/dudas.test.mjs` prueba el motor del chat sin navegador (casos, conjugaciones, acento, transliteración, temas y preguntas sobre el curso). Las pruebas (`tests/ui.test.mjs`) verifican que la página carga sin errores, que los 30 días se renderizan, que el progreso y el registro de desempeño persisten, que el índice y la referencia enlazan al día correcto, que la pestaña Curso muestra las 20 lecciones, corrige los ejercicios y guarda el avance, y que no hay desplazamiento horizontal a 375 px. Las capturas se guardan en `capturas/`.

## Dudas (chat)

Responde sin red ni modelos de lenguaje con tres fuentes: una base de temas escrita para el plan (bloque `<script type="application/json" id="dudas">`), el texto de los 30 días y `lexico.js`, un recorte del diccionario abierto de [OpenRussian.org](https://github.com/Badestrand/russian-dictionary) (Wiktionary y Tatoeba; paradigmas según la clasificación de Zalizniak): las palabras más frecuentes de cada categoría y todas las que aparecen en `index.html`, con acento, traducción inglesa, declinación, conjugación y pareja aspectual. `lexico.js` se carga solo al abrir la pestaña.

Para regenerarlo (por ejemplo, tras añadir vocabulario al plan):

```
git clone --depth 1 https://github.com/Badestrand/russian-dictionary /tmp/rd
node scripts/lexico.mjs /tmp/rd
```

Los datos del diccionario están bajo licencia [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); `lexico.js` se distribuye bajo esa misma licencia y la atribución figura en la pestaña.
