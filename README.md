# Ruso para Recepciones Diplomáticas

Plan de 30 días (Rev 2.0) en un solo archivo, `index.html`: dashboard de progreso, lección del día con temporizadores y lectura en voz rusa del navegador, índice de 30 días y referencia gramatical. El progreso se guarda en el `localStorage` del navegador (clave `ruso_recepciones_v2`) y, con la clave de sincronización de Amor de Mamá (Dashboard → Sincronización entre dispositivos), se comparte entre el teléfono y la computadora.

## Uso

Publicado en https://ruso-recepciones.pages.dev (Cloudflare Pages, cada push a `main`). También se puede abrir `index.html` directamente en el navegador.

## Pruebas (Playwright)

```
npm install
npm test
```

Las pruebas (`tests/ui.test.mjs`) verifican que la página carga sin errores, que los 30 días se renderizan, que el progreso y el registro de desempeño persisten, que el índice y la referencia enlazan al día correcto y que no hay desplazamiento horizontal a 375 px. Las capturas se guardan en `capturas/`.
