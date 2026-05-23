const SHEETS = {
  CLIENTES: 'Clientes',
  PRODUCTOS: 'ProductosPrecios',
  PEDIDOS: 'Pedidos',
  HORARIOS: 'Horarios',
};

const ESTADOS_PEDIDO = [
  'NUEVO',
  'CONFIRMADO',
  'EN PREPARACION',
  'EN REPARTO',
  'ENTREGADO',
  'REPROGRAMAR',
  'NO ENTREGADO',
  'CANCELADO',
];

const MEDIOS_PAGO = [
  'NO INFORMADO',
  'TRANSFERENCIA',
  'EFECTIVO',
  'MERCADO PAGO',
];

const OPCIONES_SI_NO = [
  'NO',
  'SI',
];

// TODO: completar cuando el cliente pase credenciales de Mercado Pago.
const MP_ACCESS_TOKEN = '';
const MP_PUBLIC_KEY = '';
const MP_WEBHOOK_URL = '';

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

    if (path === 'createPaymentPreference') {
      return jsonResponse(createPaymentPreference_(body));
    }

    if (path === 'mpWebhook') {
      return jsonResponse(mpWebhook_(body));
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

function isMpConfigured_() {
  return !!String(MP_ACCESS_TOKEN || '').trim();
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

function levenshtein_(a, b) {
  const s = canonicalAddress_(a);
  const t = canonicalAddress_(b);
  if (!s && !t) return 0;
  if (!s) return t.length;
  if (!t) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const dp = [];
  for (let i = 0; i < rows; i++) {
    dp[i] = [];
    dp[i][0] = i;
  }
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[s.length][t.length];
}

function addressScore_(query, address) {
  const q = canonicalAddress_(query);
  const a = canonicalAddress_(address);
  if (!q || !a) return 0;
  if (a.indexOf(q) !== -1) return 0.98;

  const qTokens = q.split(' ').filter(Boolean);
  const aTokens = a.split(' ').filter(Boolean);
  const numRegex = /^\d+[A-Z]?$/;
  const qNums = qTokens.filter((t) => numRegex.test(t));
  const qWords = qTokens.filter((t) => !numRegex.test(t));
  const matchedNums = qNums.filter((n) => aTokens.indexOf(n) !== -1).length;
  const matchedWords = qWords.filter(function (w) {
    if (aTokens.indexOf(w) !== -1) return true;
    // Permite un pequeno error de tipeo por palabra (ej: SOREDE -> SOREDA)
    return aTokens.some(function (aw) {
      return levenshtein_(w, aw) <= 1;
    });
  }).length;

  const numRatio = qNums.length ? (matchedNums / qNums.length) : 0;
  const wordRatio = qWords.length ? (matchedWords / qWords.length) : 0;

  const dist = levenshtein_(q, a);
  const maxLen = Math.max(q.length, a.length, 1);
  const editScore = 1 - (dist / maxLen);

  return (numRatio * 0.50) + (wordRatio * 0.35) + (editScore * 0.15);
}

function findSuggestions_(query, clientes) {
  return clientes
    .filter((c) => isEnabled_(c.activo) && String(c.direccion || '').trim())
    .map((c) => ({
      direccion: String(c.direccion || '').trim(),
      score: addressScore_(query, c.direccion),
    }))
    .filter((x) => x.score >= 0.52)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.direccion);
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
    'estado pago': 'estado_pago',
    'estado_de_pago': 'estado_pago',
    'mp payment id': 'mp_payment_id',
    'mp_payment_id': 'mp_payment_id',
    'mp status': 'mp_status',
    'mp_status': 'mp_status',
    'fecha pago': 'fecha_pago',
    'fecha_de_pago': 'fecha_pago',
    'monto pagado': 'monto_pagado',
    'monto_pagado': 'monto_pagado',
    'medio de pago': 'medio_pago',
    'medio_pago': 'medio_pago',
    'pago confirmado': 'pago_confirmado',
    'pago_confirmado': 'pago_confirmado',
    'referencia de pago': 'referencia_pago',
    'referencia_pago': 'referencia_pago',
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

  if (!client) {
    const suggestions = findSuggestions_(query, clientes);
    return { found: false, suggestions: suggestions };
  }

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
  ensurePedidosPaymentColumns_(sh);
  ensurePedidosEstadoDropdown_(sh);
  ensurePedidosPaymentDropdowns_(sh);
  const idPedido = buildOrderNumber_();
  const itemsRaw = payload.items || {};
  const qtyTotal = countSelectedItems_(itemsRaw);
  if (!qtyTotal) {
    return { ok: false, error: 'Debes seleccionar al menos un producto' };
  }
  const itemsPretty = formatItemsForSheet_(itemsRaw);
  const total = Number(payload.total || 0);
  if (!(total > 0)) {
    return { ok: false, error: 'El total del pedido debe ser mayor a cero' };
  }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const row = headers.map(function (key) {
    if (key === 'fecha_y_hora' || key === 'fecha') return new Date();
    if (key === 'nro_de_pedido' || key === 'id_pedido' || key === 'pedido') return idPedido;
    if (key === 'id_cliente') return payload.id_cliente || '';
    if (key === 'direccion') return payload.direccion || '';
    if (key === 'horario') return payload.horario || '';
    if (key === 'items' || key === 'items_json') return itemsPretty;
    if (key === 'total') return total;
    if (key === 'comentario') return payload.comentario || '';
    if (key === 'estado') return 'NUEVO';
    if (key === 'estado_pago') return 'PENDIENTE_CONFIG';
    if (key === 'mp_payment_id') return '';
    if (key === 'mp_status') return 'NO_CONFIGURADO';
    if (key === 'fecha_pago') return '';
    if (key === 'monto_pagado') return '';
    if (key === 'medio_pago') return 'NO INFORMADO';
    if (key === 'pago_confirmado') return 'NO';
    if (key === 'referencia_pago') return '';
    return '';
  });
  sh.appendRow(row);

  return { ok: true, id_pedido: idPedido };
}

function ensurePedidosPaymentColumns_(sheet) {
  const required = [
    { label: 'Estado pago', key: 'estado_pago' },
    { label: 'MP payment_id', key: 'mp_payment_id' },
    { label: 'MP status', key: 'mp_status' },
    { label: 'Fecha pago', key: 'fecha_pago' },
    { label: 'Monto pagado', key: 'monto_pagado' },
    { label: 'Medio de pago', key: 'medio_pago' },
    { label: 'Pago confirmado', key: 'pago_confirmado' },
    { label: 'Referencia de pago', key: 'referencia_pago' },
  ];

  let lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headerKeys = headerValues.map(normalizeHeader_);

  required.forEach(function (item) {
    if (headerKeys.indexOf(item.key) === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue(item.label);
      headerKeys.push(item.key);
    }
  });
}

function ensurePedidosPaymentDropdowns_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const medioPagoCol = headers.indexOf('medio_pago') + 1;
  const pagoConfirmadoCol = headers.indexOf('pago_confirmado') + 1;
  const totalRows = Math.max(sheet.getMaxRows(), 2);
  if (medioPagoCol > 0) {
    const rangeMedio = sheet.getRange(2, medioPagoCol, totalRows - 1, 1);
    const ruleMedio = SpreadsheetApp.newDataValidation()
      .requireValueInList(MEDIOS_PAGO, true)
      .setAllowInvalid(false)
      .build();
    rangeMedio.setDataValidation(ruleMedio);
  }
  if (pagoConfirmadoCol > 0) {
    const rangeConfirmado = sheet.getRange(2, pagoConfirmadoCol, totalRows - 1, 1);
    const ruleConfirmado = SpreadsheetApp.newDataValidation()
      .requireValueInList(OPCIONES_SI_NO, true)
      .setAllowInvalid(false)
      .build();
    rangeConfirmado.setDataValidation(ruleConfirmado);
  }
}

function createPaymentPreference_(payload) {
  const idPedido = String(payload.id_pedido || '').trim();
  if (!idPedido) {
    return { ok: false, error: 'Falta id_pedido' };
  }

  if (!isMpConfigured_()) {
    return {
      ok: false,
      pending_config: true,
      message: 'Mercado Pago aun no esta configurado',
    };
  }

  // Placeholder: al recibir credenciales reales, completar creacion de preferencia.
  return {
    ok: false,
    pending_config: true,
    message: 'Configuracion de Mercado Pago pendiente de credenciales',
    id_pedido: idPedido,
  };
}

function mpWebhook_(_payload) {
  // Endpoint reservado para notificaciones de Mercado Pago.
  return {
    ok: true,
    pending_config: !isMpConfigured_(),
    webhook_url: MP_WEBHOOK_URL || '',
  };
}

function ensurePedidosEstadoDropdown_(sheet) {
  const estadoCol = 9; // Columna I = Estado
  const totalRows = Math.max(sheet.getMaxRows(), 2);
  const range = sheet.getRange(2, estadoCol, totalRows - 1, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS_PEDIDO, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function setupEstadoPedidosManual() {
  const sh = getSheet_(SHEETS.PEDIDOS);
  ensurePedidosEstadoDropdown_(sh);
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

function countSelectedItems_(items) {
  return Object.keys(items || {})
    .map(function (sku) { return Number(items[sku] || 0); })
    .reduce(function (acc, qty) { return acc + (qty > 0 ? qty : 0); }, 0);
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
