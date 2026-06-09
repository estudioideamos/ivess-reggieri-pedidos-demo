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
- precio lista 1
- precio lista 2
- activo lista 1
- activo lista 2

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

## 5) Conectar frontend
Completar `API_BASE_URL` en `src/config.js` con la URL del Web App publicado.
