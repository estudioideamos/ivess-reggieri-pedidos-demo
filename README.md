# Ivess Reggieri - Canal digital

Proyecto web desarrollado por Estudio Ideamos para Ivess Reggieri.

Incluye:
- landing principal `index.html`
- flujo de pedidos `pedidos.html`
- flujo de altas `altas.html`
- backend en Google Apps Script `apps-script/Code.gs`
- manual operativo `manual.html`

## Stack
- Frontend: HTML, CSS y JavaScript vanilla
- Backend: Google Apps Script
- Base operativa: Google Sheets
- Publicacion actual: GitHub Pages o hosting estatico

## Flujo de pedidos
1. El cliente ingresa direccion o telefono.
2. El sistema identifica cliente, localidad y provincia.
3. Se muestran los horarios habilitados.
4. El cliente arma el pedido.
5. El pedido se guarda en Google Sheets.

## Hojas activas
- `Clientes`
- `Horarios`
- `ProductosPrecios`
- `Pedidos`
- `AltasAutomaticas`

## Nota operativa
- `Clientes > Lista de precios` trabaja con valores `1`, `2` y `3`.
- `ProductosPrecios` debe incluir `Precio lista 1`, `Precio lista 2` y `Precio lista 3`.

## Frontend principal
- `index.html`
- `pedidos.html`
- `altas.html`
- `landing.css`
- `styles.css`
- `src/main.js`
- `src/altas.js`
- `src/config.js`

## Backend
- El archivo principal es `apps-script/Code.gs`.
- La URL del Web App se configura en `src/config.js`.

## Nota
Se dejo el repositorio limpio con solo archivos productivos o utiles para mantenimiento. Los archivos temporales de importacion y pruebas quedaron excluidos por `.gitignore`.
