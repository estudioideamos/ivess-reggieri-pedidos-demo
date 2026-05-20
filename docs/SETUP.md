# Setup Operativo

## 1) Cuenta Google del cliente
Recomendado: una cuenta exclusiva de Ivess Reggieri para ser dueno de:
- Google Sheet
- Apps Script
- Integraciones futuras

No genera conflicto con otras cuentas/proyectos tuyos.

## 2) Crear Google Sheet con estas pestanas
1. Clientes
2. Horarios
3. ClienteHorarios
4. ProductosPrecios
5. Pedidos

## 3) Encabezados exactos
### Clientes
id_cliente | nombre | direccion | localidad | telefono | activo

### Horarios
id_horario | etiqueta | activo

### ClienteHorarios
id_cliente | id_horario

### ProductosPrecios
sku | producto | precio | activo

### Pedidos
timestamp | id_pedido | id_cliente | direccion | horario | items_json | total | comentario | estado

## 4) Publicar Apps Script
- Deploy > New deployment > Web app
- Execute as: Me
- Who has access: Anyone

## 5) Conectar frontend
En `src/config.js` completar `API_BASE_URL` con la URL del Web App.
