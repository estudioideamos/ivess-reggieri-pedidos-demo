const SHEETS = {
  CLIENTES: 'Clientes',
  PRODUCTOS: 'ProductosPrecios',
  PEDIDOS: 'Pedidos',
  CLIENTE_HORARIOS: 'ClienteHorarios',
  HORARIOS: 'Horarios',
};

function doPost(e) {
  try {
    const path = (e.parameter.path || '').trim();
    const body = JSON.parse(e.postData.contents || '{}');

    if (path === 'findClient') {
      return jsonResponse(findClient_(body.query));
    }

    if (path === 'createOrder') {
      return jsonResponse(createOrder_(body));
    }
    
    if (path === 'getCatalog') {
      return jsonResponse(getCatalog_(body.lista_precio));
    }

    return jsonResponse({ error: 'Ruta invalida' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: 'Ivess Reggieri API' });
}

function normalize_(v) {
  return String(v || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('No existe hoja: ' + name);
  return sh;
}

function mapByHeaders_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

function findClient_(query) {
  const q = normalize_(query);
  const clientes = mapByHeaders_(getSheet_(SHEETS.CLIENTES));
  const horarios = mapByHeaders_(getSheet_(SHEETS.HORARIOS));
  const clienteHorarios = mapByHeaders_(getSheet_(SHEETS.CLIENTE_HORARIOS));

  const client = clientes.find((c) => {
    return normalize_(c.direccion).includes(q) || normalize_(c.telefono) === q;
  });

  if (!client) return { found: false };

  const ids = clienteHorarios
    .filter((ch) => String(ch.id_cliente) === String(client.id_cliente))
    .map((ch) => String(ch.id_horario));

  const etiquetas = horarios
    .filter((h) => ids.includes(String(h.id_horario)) && String(h.activo) !== '0')
    .map((h) => h.etiqueta);

  return {
    found: true,
    client: {
      id_cliente: String(client.id_cliente),
      nombre: String(client.nombre || ''),
      direccion: String(client.direccion || ''),
      localidad: String(client.localidad || ''),
      telefono: String(client.telefono || ''),
      lista_precio: Number(client.lista_precio || 1),
      horarios: etiquetas,
    },
  };
}

function getCatalog_(listaPrecio) {
  const productos = mapByHeaders_(getSheet_(SHEETS.PRODUCTOS));
  const lista = Number(listaPrecio || 1) === 2 ? 2 : 1;
  const precioCol = lista === 2 ? 'precio_lista_2' : 'precio_lista_1';

  const catalogo = productos
    .filter((p) => String(p.activo || '1') !== '0')
    .map((p) => ({
      sku: String(p.sku || ''),
      nombre: String(p.producto || ''),
      precio: Number(p[precioCol] || 0),
    }));

  return { ok: true, lista_precio: lista, productos: catalogo };
}

function createOrder_(payload) {
  const sh = getSheet_(SHEETS.PEDIDOS);
  const idPedido = Utilities.getUuid();
  sh.appendRow([
    new Date(),
    idPedido,
    payload.id_cliente || '',
    payload.direccion || '',
    payload.horario || '',
    JSON.stringify(payload.items || {}),
    Number(payload.total || 0),
    payload.comentario || '',
    'NUEVO',
  ]);

  return { ok: true, id_pedido: idPedido };
}

function jsonResponse(data, statusCode) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
