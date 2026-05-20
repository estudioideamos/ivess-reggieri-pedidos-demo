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
    
    if (path === 'getAddressBook') {
      return jsonResponse(getAddressBook_());
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

function canonicalAddress_(v) {
  const base = normalize_(v)
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stop = { AV: true, AVENIDA: true, PASAJE: true, PSJE: true, CALLE: true };
  return base
    .split(' ')
    .filter(function (t) { return t && !stop[t]; })
    .join(' ');
}

function addressMatches_(inputAddress, storedAddress) {
  var query = canonicalAddress_(inputAddress);
  var full = canonicalAddress_(storedAddress);
  if (!query || !full) return false;
  if (query === full) return true;
  var qTokens = query.split(' ').filter(function (t) { return t; });
  var fTokens = full.split(' ').filter(function (t) { return t; });
  var numRegex = /^\d+[A-Z]?$/;
  var qNums = qTokens.filter(function (t) { return numRegex.test(t); });
  if (!qNums.length) return false;
  var hasAllNums = qNums.every(function (n) { return fTokens.indexOf(n) !== -1; });
  if (!hasAllNums) return false;
  var qWords = qTokens.filter(function (t) { return !numRegex.test(t); });
  return qWords.every(function (w) { return fTokens.indexOf(w) !== -1; });
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
    'imagen_url': 'imagen_url',
    'imagen url': 'imagen_url',
    'imagen': 'imagen_url',
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
    return isEnabled_(c.activo) && (addressMatches_(query, c.direccion) || normalize_(c.telefono) === q);
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
      image_url: String(p.imagen_url || ''),
    }));

  return { ok: true, lista_precio: lista, productos: catalogo };
}

function createOrder_(payload) {
  const sh = getSheet_(SHEETS.PEDIDOS);
  const idPedido = buildOrderNumber_();
  const itemsRaw = payload.items || {};
  const itemsPretty = formatItemsForSheet_(itemsRaw);
  sh.appendRow([
    new Date(),
    idPedido,
    payload.id_cliente || '',
    payload.direccion || '',
    payload.horario || '',
    itemsPretty,
    Number(payload.total || 0),
    payload.comentario || '',
    'NUEVO',
  ]);

  return { ok: true, id_pedido: idPedido };
}

function buildOrderNumber_() {
  const now = new Date();
  const tz = Session.getScriptTimeZone();
  const stamp = Utilities.formatDate(now, tz, 'yyMMdd-HHmmss');
  const rand = Math.floor(100 + Math.random() * 900);
  return 'PED-' + stamp + '-' + rand;
}

function formatItemsForSheet_(items) {
  const productos = mapByHeaders_(getSheet_(SHEETS.PRODUCTOS));
  const bySku = {};
  productos.forEach((p) => {
    const sku = String(p.sku || '').trim();
    if (sku) bySku[sku] = String(p.producto || sku).trim();
  });

  const lines = Object.keys(items)
    .map((sku) => ({ sku: String(sku), qty: Number(items[sku] || 0) }))
    .filter((x) => x.qty > 0)
    .map((x) => `${x.qty} x ${bySku[x.sku] || x.sku}`);

  return lines.length ? lines.join(' | ') : 'Sin productos';
}

function getAddressBook_() {
  const clientes = mapByHeaders_(getSheet_(SHEETS.CLIENTES))
    .filter((c) => isEnabled_(c.activo))
    .map((c) => String(c.direccion || '').trim())
    .filter((v) => v);

  const unique = clientes.filter((v, i, arr) => arr.indexOf(v) === i);
  return { ok: true, direcciones: unique };
}

function jsonResponse(data, statusCode) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
