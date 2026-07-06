# Setup Operativo

## 1) Cuenta Google del cliente
Recomendado: una cuenta exclusiva de Ivess Reggieri para ser duena de:
- Google Sheet
- Apps Script
- futuras integraciones

## 2) Hojas activas
1. `Clientes`
2. `Horarios`
3. `ProductosPrecios`
4. `Pedidos`
5. `AltasAutomaticas`

## 3) Estructura general
### Clientes
- nro de cliente
- direccion
- provincia
- localidad
- celular
- telefono
- activo
- lista de precios
- horario 1
- horario 2
- horario 3
- horario 4
- comentarios

### Horarios
- nro de horario
- franja horaria
- activo

### ProductosPrecios
- codigo producto
- producto
- image url
- precio lista 1
- precio lista 2
- precio lista 3
- activo lista 1
- activo lista 2
- activo

### Pedidos
- fecha y hora
- nro de pedido
- nro de cliente
- direccion
- provincia
- localidad
- horario
- items (json)
- total
- comentario
- estado

### AltasAutomaticas
- fecha y hora
- direccion
- localidad
- codigo area
- celular
- telefono completo
- origen
- estado

## 4) Publicar Apps Script
- `Implementar` > `Nueva implementacion`
- Tipo: `Aplicacion web`
- Ejecutar como: `yo`
- Acceso: `cualquier persona`

## 4.1) Preparar lista 3
- actualizar `apps-script/Code.gs` en el proyecto real de Apps Script
- guardar cambios
- si el frontend usa el Web App productivo, volver a desplegar
- en Google Sheets correr `Ayuda Ivess > Preparar lista 3 de precios`
- verificar columna `Precio lista 3` en `ProductosPrecios`
- verificar dropdown `1 / 2 / 3` en `Clientes > Lista de precios`

## 5) Conectar frontend
Completar `API_BASE_URL` en `src/config.js` con la URL del Web App publicado.
