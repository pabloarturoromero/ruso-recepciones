# Ruso para Recepciones Diplomáticas

Plan de 30 días (Rev 2.1) en un solo archivo, `index.html`: dashboard de progreso y diagnóstico de puntos débiles, lección del día con temporizadores y lectura en voz rusa del navegador, repaso espaciado de unas 300 frases (plan, básico, números, días, meses, horas, colores, comida, diplomacia, Antártida, muletillas) con exportación a Anki, grabación y autoevaluación de la pronunciación, simulador de recepciones con cinco escenarios, índice de 30 días, referencia gramatical y tarjeta de bolsillo imprimible. El progreso de los 30 días se guarda en el `localStorage` del navegador (clave `ruso_recepciones_v2`); el repaso, la pronunciación y las simulaciones, en `ruso_recepciones_repaso_v1`.

## Uso

Publicado en https://ruso-recepciones.pages.dev (Cloudflare Pages, cada push a `main`). También se puede abrir `index.html` directamente en el navegador.

## Pruebas (Playwright)

```
npm install
npm test
```

Las pruebas (`tests/ui.test.mjs`) verifican que la página carga sin errores, el vocabulario (ids únicos y referencias de los escenarios), el programador de repasos, la exportación a Anki, el simulador, el diagnóstico, la tarjeta de bolsillo, que los 30 días se renderizan, que el progreso y el registro de desempeño persisten, que el índice y la referencia enlazan al día correcto y que no hay desplazamiento horizontal a 375 px. Las capturas se guardan en `capturas/`.
