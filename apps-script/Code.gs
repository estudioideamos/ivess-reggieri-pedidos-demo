const SHEETS = {
  CLIENTES: 'Clientes',
  PRODUCTOS: 'ProductosPrecios',
  PEDIDOS: 'Pedidos',
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

function isEnabled_(value) {
  const v = normalize_(value);
  if (v === '' || v === '1' || v === 'SI' || v === 'SÍ' || v === 'TRUE' || v === 'VERDADERO') {
    return true;
  }
  if (v === '0' || v === 'NO' || v === 'FALSE' || v === 'FALSO') {
    return false;
  }
  return true;
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
    headers.forEach((h, i) => {
      const key = normalizeHeader_(h);
      obj[key] = row[i];
    });
    return obj;
  });
}

function normalizeHeader_(h) {
  const raw = String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const map = {
    'id_cliente': 'id_cliente',
    'nro de cliente': 'id_cliente',
    'numero de cliente': 'id_cliente',
    'cliente id': 'id_cliente',
    'nombre': 'nombre',
    'direccion': 'direccion',
    'localidad': 'localidad',
    'telefono': 'telefono',
    'activo': 'activo',
    'lista_precio': 'lista_precio',
    'lista de precio': 'lista_precio',
    'lista de precios': 'lista_precio',
    'id_horario': 'id_horario',
    'nro de horario': 'id_horario',
    'numero de horario': 'id_horario',
    'etiqueta': 'etiqueta',
    'franja horaria': 'etiqueta',
    'sku': 'sku',
    'codigo producto': 'sku',
    'producto': 'producto',
    'precio_lista_1': 'precio_lista_1',
    'precio lista 1': 'precio_lista_1',
    'precio_lista_2': 'precio_lista_2',
    'precio lista 2': 'precio_lista_2',
    'activo_lista_1': 'activo_lista_1',
    'activo lista 1': 'activo_lista_1',
    'activo_lista_2': 'activo_lista_2',
    'activo lista 2': 'activo_lista_2',
    'horario_1': 'horario_1',
    'horario_2': 'horario_2',
    'horario_3': 'horario_3',
    'horario_4': 'horario_4',
    'horario 1': 'horario_1',
    'horario 2': 'horario_2',
    'horario 3': 'horario_3',
    'horario 4': 'horario_4',
    'nro horario 1': 'horario_1',
    'nro horario 2': 'horario_2',
    'nro horario 3': 'horario_3',
    'nro horario 4': 'horario_4',
  };

  return map[raw] || raw.replace(/\s+/g, '_');
}

function findClient_(query) {
  const q = normalize_(query);
  const clientes = mapByHeaders_(getSheet_(SHEETS.CLIENTES));
  const horarios = mapByHeaders_(getSheet_(SHEETS.HORARIOS));

  const client = clientes.find((c) => {
    return isEnabled_(c.activo) && (normalize_(c.direccion).includes(q) || normalize_(c.telefono) === q);
  });

  if (!client) return { found: false };

  const ids = ['horario_1', 'horario_2', 'horario_3', 'horario_4']
    .map((k) => String(client[k] || '').trim())
    .filter((v) => v && v !== '0');

  const etiquetas = horarios
    .filter((h) => ids.includes(String(h.id_horario)) && isEnabled_(h.activo))
    .map((h) => h.etiqueta);

  return {
    found: true,
    client: {
      id_cliente: String(client.id_cliente),
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
  const activoPorListaCol = lista === 2 ? 'activo_lista_2' : 'activo_lista_1';

  const catalogo = productos
    .filter((p) => {
      const activoLista = p[activoPorListaCol];
      if (activoLista !== '' && activoLista !== null && activoLista !== undefined) {
        return isEnabled_(activoLista);
      }
      return isEnabled_(p.activo);
    })
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
