# Ivess Reggieri - Demo Pedidos

Demo mobile-first para toma de pedidos de agua/soda con deteccion de cliente por direccion y horarios asignados.

## Stack
- Frontend: HTML + CSS + JS (sin framework)
- Backend productivo: Google Apps Script + Google Sheets
- Hosting demo: GitHub Pages (frontend)

## Flujo
1. Cliente ingresa direccion o telefono.
2. Sistema identifica cliente.
3. Muestra solo horarios habilitados para ese cliente.
4. Cliente arma pedido.
5. Se confirma pedido y se envia al backend.

## Estructura de hojas Google Sheets
- `Clientes`: id_cliente, nombre, direccion, localidad, telefono, activo
- `Horarios`: id_horario, etiqueta, activo
- `ClienteHorarios`: id_cliente, id_horario
- `ProductosPrecios`: sku, producto, precio, activo
- `Pedidos`: timestamp, id_pedido, id_cliente, direccion, horario, items_json, total, comentario, estado

## Configuracion local
Abrir `index.html` en navegador o servir con cualquier servidor estatico.

## Configuracion backend
1. Crear proyecto de Google Apps Script.
2. Copiar contenido de `apps-script/Code.gs`.
3. Publicar como Web App.
4. Copiar URL y pegar en `src/config.js` como `API_BASE_URL`.

## Deploy demo a GitHub Pages
1. Crear repo en GitHub.
2. `git remote add origin <url>`
3. `git add . && git commit -m "Demo Ivess Reggieri"`
4. `git push -u origin main`
5. En GitHub: Settings > Pages > Deploy from branch `main` `/root`.
