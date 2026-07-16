const SHEETS = {
  CLIENTES: 'Clientes',
  PRODUCTOS: 'ProductosPrecios',
  PEDIDOS: 'Pedidos',
  HORARIOS: 'Horarios',
  ALTAS: 'AltasAutomaticas',
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

const ESTADOS_ALTA = [
  'NUEVO',
  'PENDIENTE CONTACTO',
  'PRIMER INTENTO',
  'SEGUNDO INTENTO',
  'CONTACTADO',
  'INTERESADO',
  'NO INTERESADO',
  'NO RESPONDE',
  'DATOS INCOMPLETOS',
  'ALTA CONCRETADA',
];
const CABA_BARRIOS = [
  'AGRONOMIA',
  'ALMAGRO',
  'BALVANERA',
  'BARRACAS',
  'BELGRANO',
  'BOCA',
  'BOEDO',
  'CABALLITO',
  'CHACARITA',
  'COGHLAN',
  'COLEGIALES',
  'CONSTITUCION',
  'FLORES',
  'FLORESTA',
  'LA PATERNAL',
  'LINIERS',
  'MATADEROS',
  'MONSERRAT',
  'MONTE CASTRO',
  'NUEVA POMPEYA',
  'NUNEZ',
  'PALERMO',
  'PARQUE AVELLANEDA',
  'PARQUE CHACABUCO',
  'PARQUE CHAS',
  'PARQUE PATRICIOS',
  'PUERTO MADERO',
  'RECOLETA',
  'RETIRO',
  'SAAVEDRA',
  'SAN CRISTOBAL',
  'SAN NICOLAS',
  'SAN TELMO',
  'VELEZ SARSFIELD',
  'VERSALLES',
  'VILLA CRESPO',
  'VILLA DEL PARQUE',
  'VILLA DEVOTO',
  'VILLA GENERAL MITRE',
  'VILLA LUGANO',
  'VILLA LURO',
  'VILLA ORTUZAR',
  'VILLA PUEYRREDON',
  'VILLA REAL',
  'VILLA RIACHUELO',
  'VILLA SANTA RITA',
  'VILLA SOLDATI',
  'VILLA URQUIZA',
];
const MANUAL_URL = 'https://estudioideamos.github.io/ivess-reggieri-pedidos-demo/manual.html';
const SHEET_META_KEY = 'IVESS_EXPECTED_SHEET_NAME';

const REQUIRED_HEADERS = {
  Clientes: [
    'id_cliente', 'direccion', 'localidad', 'provincia', 'celular', 'telefono', 'activo',
    'lista_precio', 'horario_1', 'horario_2', 'horario_3', 'horario_4',
  ],
  Horarios: [
    'id_horario', 'etiqueta', 'activo',
  ],
  ProductosPrecios: [
    'sku', 'producto', 'imagen_url', 'precio_lista_1', 'precio_lista_2', 'precio_lista_3', 'activo_lista_1', 'activo_lista_2', 'activo',
  ],
  Pedidos: [
    'fecha_y_hora', 'nro_de_pedido', 'id_cliente', 'direccion', 'provincia', 'localidad', 'horario', 'items_json', 'total', 'comentario', 'estado',
  ],
  AltasAutomaticas: [
    'fecha_y_hora', 'direccion', 'localidad', 'codigo_area', 'celular', 'telefono_completo', 'comentario', 'origen', 'estado',
  ],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ayuda Ivess')
      .addItem('Abrir manual', 'openManual_')
      .addSeparator()
      .addItem('Reparar dropdowns de Clientes', 'setupClientesDropdownsManual')
      .addItem('Preparar lista 3 de precios', 'setupPriceList3Manual')
      .addItem('Ordenar pedidos existentes', 'sortPedidosManual')
      .addItem('Activar proteccion de estructura', 'setupCriticalStructureProtection_')
      .addItem('Limpiar columnas de pago (legacy)', 'removePedidosPaymentColumnsManual')
      .addToUi();
}

function onEdit(e) {
  try {
    handleClientesSheetEdit_(e);
  } catch (_err) {
    // No interrumpimos la edicion manual por un error de automatizacion.
  }
}

function handleClientesSheetEdit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== SHEETS.CLIENTES) return;

  const cols = getClientesDropdownColumns_(sheet);
  if (cols.provinciaCol <= 0 || cols.localidadCol <= 0) return;

  const startRow = e.range.getRow();
  const endRow = e.range.getLastRow();
  const startCol = e.range.getColumn();
  const endCol = e.range.getLastColumn();
  const touchesProvincia = cols.provinciaCol > 0 && startCol <= cols.provinciaCol && endCol >= cols.provinciaCol;
  const touchesLocalidad = cols.localidadCol > 0 && startCol <= cols.localidadCol && endCol >= cols.localidadCol;
  const touchesListaPrecio = cols.listaPrecioCol > 0 && startCol <= cols.listaPrecioCol && endCol >= cols.listaPrecioCol;

  if (!touchesProvincia && !touchesLocalidad && !touchesListaPrecio) return;

  const provinciaRule = getClientesProvinciaRule_(sheet, cols.provinciaCol);
  const localidadTemplates = getClientesLocalidadRuleTemplates_(sheet, cols.provinciaCol, cols.localidadCol);
  const listaPrecioRule = buildClientesListaPrecioRule_();

  for (let row = Math.max(startRow, 2); row <= endRow; row++) {
    ensureClientesDropdownsAtRow_(sheet, row, cols, provinciaRule, localidadTemplates, listaPrecioRule);
    if (touchesProvincia && !touchesLocalidad) {
      sheet.getRange(row, cols.localidadCol).clearContent();
    }
  }
}

function openManual_() {
  const html = HtmlService.createHtmlOutput(
    '<script>' +
    'window.open("' + MANUAL_URL + '","_blank");' +
    'google.script.host.close();' +
    '</script>'
  )
    .setWidth(10)
    .setHeight(10);
  SpreadsheetApp.getUi().showModalDialog(html, 'Abriendo manual...');
}

function setupCriticalStructureProtection_() {
  const ss = SpreadsheetApp.getActive();
  const me = Session.getEffectiveUser().getEmail();

  Object.keys(SHEETS).forEach(function (k) {
    const sheetName = SHEETS[k];
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;

    // 1) Marca interna para restaurar nombre de hoja si lo cambian.
    sh.addDeveloperMetadata(SHEET_META_KEY, sheetName);

    // 2) Protege fila 1 (encabezados).
    const headerRange = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1));
    const protections = headerRange.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    const p = protections.length ? protections[0] : headerRange.protect();
    p.setDescription('IVESS - Encabezados protegidos');
    p.setWarningOnly(false);
    if (p.canDomainEdit()) p.setDomainEdit(false);
    const editors = p.getEditors().map(function (u) { return u.getEmail(); });
    editors.forEach(function (ed) {
      if (ed !== me) p.removeEditor(ed);
    });
  });

  ensureCriticalTriggers_();
  SpreadsheetApp.getActive().toast('Proteccion activada. Encabezados bloqueados y nombres de hojas vigilados.', 'Ivess', 6);
}

function ensureCriticalTriggers_() {
  const ssId = SpreadsheetApp.getActive().getId();
  const exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'guardCriticalStructure_' &&
      t.getEventType() === ScriptApp.EventType.ON_CHANGE &&
      t.getTriggerSourceId() === ssId;
  });
  if (!exists) {
    ScriptApp.newTrigger('guardCriticalStructure_')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onChange()
      .create();
  }
}

function guardCriticalStructure_(_e) {
  restoreRenamedCriticalSheets_();
}

function restoreRenamedCriticalSheets_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  const existingByName = {};
  sheets.forEach(function (s) { existingByName[s.getName()] = true; });

  sheets.forEach(function (sh) {
    const meta = sh.getDeveloperMetadata().filter(function (m) {
      return m.getKey() === SHEET_META_KEY;
    });
    if (!meta.length) return;
    const expectedName = String(meta[0].getValue() || '').trim();
    if (!expectedName) return;
    if (sh.getName() === expectedName) return;

    // Si ya existe una hoja con ese nombre, evitamos colision.
    if (existingByName[expectedName]) return;

    sh.setName(expectedName);
    existingByName[expectedName] = true;
  });
}

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

    if (path === 'getLocalidades') {
      return jsonResponse(getLocalidades_());
    }

    if (path === 'createLead') {
      return jsonResponse(createLead_(body));
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
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Z])/g, '$1 $2')
    .replace(/\bBRADERO\b/g, 'BARADERO')
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
      localidad: String(c.localidad || '').trim(),
      provincia: String(c.provincia || '').trim(),
      score: addressScore_(query, c.direccion),
    }))
    .filter((x) => x.score >= 0.52)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => ({
      direccion: x.direccion,
      localidad: x.localidad,
      provincia: x.provincia,
    }));
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
    'nro cliente': 'id_cliente',
    'nombre': 'nombre',
    'direccion': 'direccion',
    'localidad': 'localidad',
    'provincia': 'provincia',
    'telefono': 'telefono',
    'telefono fijo': 'telefono',
    'fijo': 'telefono',
    'celular': 'celular',
    'telefono celular': 'celular',
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
    'precio_lista_3': 'precio_lista_3',
    'precio lista 3': 'precio_lista_3',
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
    'items': 'items_json',
    'items (json)': 'items_json',
    'items(json)': 'items_json',
    'items json': 'items_json',
  };

  return map[raw] || raw.replace(/\s+/g, '_');
}

function findClient_(query) {
  const q = normalize_(query);
  const clientes = mapByHeaders_(getSheet_(SHEETS.CLIENTES));
  const horarios = mapByHeaders_(getSheet_(SHEETS.HORARIOS));

  const client = clientes.find((c) => {
    const celular = String(c.celular || '').trim();
    const telefono = String(c.telefono || '').trim();
    return isEnabled_(c.activo) && (
      addressMatches_(query, c.direccion) ||
      normalize_(celular) === q ||
      normalize_(telefono) === q
    );
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
      provincia: String(client.provincia || ''),
      telefono: String(client.celular || client.telefono || ''),
      celular: String(client.celular || ''),
      telefono_fijo: String(client.telefono || ''),
      lista_precio: Number(client.lista_precio || 1),
      horarios: etiquetas,
    },
  };
}

function getCatalog_(listaPrecio) {
  const productos = mapByHeaders_(getSheet_(SHEETS.PRODUCTOS));
  const listaRaw = Number(listaPrecio || 1);
  const lista = [1, 2, 3].indexOf(listaRaw) !== -1 ? listaRaw : 1;
  const precioCol = lista === 3 ? 'precio_lista_3' : (lista === 2 ? 'precio_lista_2' : 'precio_lista_1');
  const activoPorListaCol = lista === 2 ? 'activo_lista_2' : (lista === 1 ? 'activo_lista_1' : '');

  const catalogo = productos
    .filter((p) => {
      const activoLista = activoPorListaCol ? p[activoPorListaCol] : '';
      if (activoPorListaCol && activoLista !== '' && activoLista !== null && activoLista !== undefined) {
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
  ensurePedidosProvinciaColumn_(sh);
  ensurePedidosLocalidadColumn_(sh);
  ensurePedidosEstadoDropdown_(sh);
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
    if (key === 'provincia') return payload.provincia || '';
    if (key === 'localidad') return payload.localidad || '';
    if (key === 'horario') return payload.horario || '';
    if (key === 'items' || key === 'items_json') return itemsPretty;
    if (key === 'total') return total;
    if (key === 'comentario') return payload.comentario || '';
    if (key === 'estado') return 'NUEVO';
    return '';
  });
  const lastCol = sh.getLastColumn();
  const hadDataRows = sh.getLastRow() >= 2;
  sh.insertRowAfter(1);
  if (hadDataRows) {
    sh
      .getRange(3, 1, 1, lastCol)
      .copyTo(sh.getRange(2, 1, 1, lastCol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  } else {
    sh.getRange(2, 1, 1, lastCol).setFontColor('#000000').setFontWeight('normal');
  }
  sh.getRange(2, 1, 1, row.length).setValues([row]);
  sh.getRange(2, 1, 1, lastCol).setFontColor('#000000').setFontWeight('normal');
  ensurePedidosEstadoValidationAtRow_(sh, 2);
  sortPedidosNewestFirst_(sh);
  ensurePedidosDataTextStyle_(sh);
  ensurePedidosEstadoValidationAtRow_(sh, 2);

  return { ok: true, id_pedido: idPedido };
}

function sortPedidosNewestFirst_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 2 || lastCol <= 0) return;
  sheet
    .getRange(2, 1, lastRow - 1, lastCol)
    .sort([{ column: 1, ascending: false }]);
}

function sortPedidosManual() {
  const sh = getSheet_(SHEETS.PEDIDOS);
  sortPedidosNewestFirst_(sh);
  ensurePedidosDataTextStyle_(sh);
  SpreadsheetApp.getActive().toast('Pedidos ordenados del mas reciente al mas antiguo.', 'Ivess', 4);
}

function setupClientesDropdownsManual() {
  const sh = getSheet_(SHEETS.CLIENTES);
  ensureClientesDropdowns_(sh);
  SpreadsheetApp.getActive().toast('Dropdowns de Clientes reparados.', 'Ivess', 4);
}

function setupPriceList3Manual() {
  const productosSheet = getSheet_(SHEETS.PRODUCTOS);
  const clientesSheet = getSheet_(SHEETS.CLIENTES);
  ensureProductosPrecioLista3Column_(productosSheet);
  ensureClientesDropdowns_(clientesSheet);
  SpreadsheetApp.getActive().toast('Lista 3 preparada en ProductosPrecios y Clientes.', 'Ivess', 6);
}

function ensurePedidosDataTextStyle_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol <= 0) return;
  sheet
    .getRange(2, 1, lastRow - 1, lastCol)
    .setFontColor('#000000')
    .setFontWeight('normal');
}

function ensurePedidosEstadoDropdown_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const estadoCol = headers.indexOf('estado') + 1;
  if (estadoCol <= 0) return;
  const totalRows = Math.max(sheet.getMaxRows(), 2);
  const range = sheet.getRange(2, estadoCol, totalRows - 1, 1);
  const rule = buildPedidosEstadoRule_();
  range.setDataValidation(rule);
}

function ensureClientesDropdowns_(sheet) {
  const cols = getClientesDropdownColumns_(sheet);
  if (cols.provinciaCol <= 0 && cols.localidadCol <= 0 && cols.listaPrecioCol <= 0) return;

  const totalRows = Math.max(sheet.getLastRow() - 1, 1);
  const provinciaRule = getClientesProvinciaRule_(sheet, cols.provinciaCol);
  const localidadTemplates = getClientesLocalidadRuleTemplates_(sheet, cols.provinciaCol, cols.localidadCol);
  const listaPrecioRule = buildClientesListaPrecioRule_();

  if (provinciaRule && cols.provinciaCol > 0) {
    sheet.getRange(2, cols.provinciaCol, totalRows, 1).setDataValidation(provinciaRule);
  }
  if (listaPrecioRule && cols.listaPrecioCol > 0) {
    sheet.getRange(2, cols.listaPrecioCol, totalRows, 1).setDataValidation(listaPrecioRule);
  }

  for (let row = 2; row <= totalRows + 1; row++) {
    ensureClientesDropdownsAtRow_(sheet, row, cols, provinciaRule, localidadTemplates, listaPrecioRule);
  }
}

function ensureClientesDropdownsAtRow_(sheet, row, cols, provinciaRule, localidadTemplates, listaPrecioRule) {
  if (row < 2) return;

  if (provinciaRule && cols.provinciaCol > 0) {
    sheet.getRange(row, cols.provinciaCol).setDataValidation(provinciaRule);
  }
  if (listaPrecioRule && cols.listaPrecioCol > 0) {
    sheet.getRange(row, cols.listaPrecioCol).setDataValidation(listaPrecioRule);
  }

  if (cols.provinciaCol <= 0 || cols.localidadCol <= 0) return;

  const provincia = normalize_(sheet.getRange(row, cols.provinciaCol).getDisplayValue());
  const localidadCell = sheet.getRange(row, cols.localidadCol);
  const localidadRule = getClientesLocalidadRuleForProvincia_(provincia, localidadTemplates);

  if (localidadRule) {
    localidadCell.setDataValidation(localidadRule);
  } else {
    localidadCell.clearDataValidations();
  }
}

function getClientesDropdownColumns_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
  return {
    provinciaCol: headers.indexOf('provincia') + 1,
    localidadCol: headers.indexOf('localidad') + 1,
    listaPrecioCol: headers.indexOf('lista_precio') + 1,
  };
}

function buildClientesListaPrecioRule_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(['1', '2', '3'], true)
    .setAllowInvalid(false)
    .build();
}

function getClientesProvinciaRule_(sheet, provinciaCol) {
  const lastRow = sheet.getLastRow();
  if (provinciaCol > 0 && lastRow >= 2) {
    const rules = sheet.getRange(2, provinciaCol, lastRow - 1, 1).getDataValidations();
    for (let i = 0; i < rules.length; i++) {
      if (rules[i][0]) return rules[i][0];
    }
  }

  return SpreadsheetApp.newDataValidation()
    .requireValueInList(['CABA', 'PBA'], true)
    .setAllowInvalid(false)
    .build();
}

function getClientesLocalidadRuleTemplates_(sheet, provinciaCol, localidadCol) {
  const templates = { byProvince: {}, fallback: null };
  const lastRow = sheet.getLastRow();
  if (provinciaCol <= 0 || localidadCol <= 0 || lastRow < 2) return templates;

  const provincias = sheet.getRange(2, provinciaCol, lastRow - 1, 1).getDisplayValues();
  const rules = sheet.getRange(2, localidadCol, lastRow - 1, 1).getDataValidations();

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i][0];
    if (!rule) continue;

    if (!templates.fallback) {
      templates.fallback = rule;
    }

    const provincia = normalize_(provincias[i][0]);
    if (provincia && !templates.byProvince[provincia]) {
      templates.byProvince[provincia] = rule;
    }
  }

  return templates;
}

function getClientesLocalidadRuleForProvincia_(provincia, templates) {
  if (provincia === 'CABA') {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(CABA_BARRIOS, true)
      .setAllowInvalid(false)
      .build();
  }

  if (provincia === 'PBA') {
    return null;
  }

  if (!provincia) return null;
  return templates.byProvince[provincia] || templates.fallback || null;
}

function ensurePedidosEstadoValidationAtRow_(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const estadoCol = headers.indexOf('estado') + 1;
  if (estadoCol <= 0 || row < 2) return;
  sheet.getRange(row, estadoCol).setDataValidation(buildPedidosEstadoRule_());
}

function buildPedidosEstadoRule_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS_PEDIDO, true)
    .setAllowInvalid(false)
    .build();
}

function setupEstadoPedidosManual() {
  const sh = getSheet_(SHEETS.PEDIDOS);
  ensurePedidosProvinciaColumn_(sh);
  ensurePedidosLocalidadColumn_(sh);
  ensurePedidosEstadoDropdown_(sh);
}

function ensurePedidosProvinciaColumn_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headersRaw = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headers = headersRaw.map(normalizeHeader_);
  if (headers.indexOf('provincia') !== -1) return;
  const direccionCol = headers.indexOf('direccion') + 1;
  if (direccionCol <= 0) return;
  sheet.insertColumnAfter(direccionCol);
  sheet.getRange(1, direccionCol + 1).setValue('Provincia');
}

function ensurePedidosLocalidadColumn_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headersRaw = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headers = headersRaw.map(normalizeHeader_);
  if (headers.indexOf('localidad') !== -1) return;
  const provinciaCol = headers.indexOf('provincia') + 1;
  const direccionCol = headers.indexOf('direccion') + 1;
  const insertAfter = provinciaCol > 0 ? provinciaCol : direccionCol;
  if (insertAfter <= 0) return;
  sheet.insertColumnAfter(insertAfter);
  sheet.getRange(1, insertAfter + 1).setValue('Localidad');
}

function removePedidosPaymentColumnsManual() {
  const sh = getSheet_(SHEETS.PEDIDOS);
  const headersRaw = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const cols = [];

  headersRaw.forEach(function (raw, idx) {
    const h = normalizeHeader_(raw);
    const rawNorm = normalize_(raw).toLowerCase();
    const legacyMatch =
      h === 'estado_pago' ||
      h === 'mp_payment_id' ||
      h === 'mp_status' ||
      h === 'fecha_pago' ||
      h === 'monto_pagado' ||
      h === 'medio_pago' ||
      h === 'pago_confirmado' ||
      h === 'referencia_pago';

    const broadMatch =
      rawNorm.indexOf('mercado pago') !== -1 ||
      rawNorm.indexOf('medio de pago') !== -1 ||
      rawNorm.indexOf('referencia de pago') !== -1 ||
      rawNorm.indexOf('mp') !== -1 ||
      (rawNorm.indexOf('pago') !== -1 && rawNorm.indexOf('estado') !== -1);

    if (legacyMatch || broadMatch) cols.push(idx + 1);
  });

  cols.sort(function (a, b) { return b - a; }).forEach(function (col) { sh.deleteColumn(col); });
  SpreadsheetApp.getActive().toast('Columnas de pago legacy eliminadas: ' + cols.length, 'Ivess', 6);
}

function ensureProductosPrecioLista3Column_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headersRaw = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headers = headersRaw.map(normalizeHeader_);
  if (headers.indexOf('precio_lista_3') !== -1) return;

  const precioLista2Col = headers.indexOf('precio_lista_2') + 1;
  const insertAfter = precioLista2Col > 0 ? precioLista2Col : lastCol;
  sheet.insertColumnAfter(insertAfter);
  sheet.getRange(1, insertAfter + 1).setValue('Precio lista 3');
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

function getLocalidades_() {
  return { ok: true, localidades: getLocalidadesFromClientes_() };
}

function createLead_(payload) {
  const direccion = String(payload.direccion || '').trim().toUpperCase();
  const localidad = String(payload.localidad || '').trim();
  const codigoArea = String(payload.codigo_area || '').trim();
  const celular = String(payload.celular || '').trim();
  const comentario = String(payload.comentario || '').trim();

  if (!direccion) return { ok: false, error: 'Falta direccion' };
  if (!localidad) return { ok: false, error: 'Falta localidad' };
  if (!codigoArea) return { ok: false, error: 'Falta codigo de area' };
  if (!celular) return { ok: false, error: 'Falta celular' };

  const sh = getOrCreateAltasSheet_();
  applyAltasSheetLayout_(sh);
  ensureAltasDropdowns_(sh);
  const telefonoCompleto = codigoArea + celular;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const row = headers.map(function (key) {
    if (key === 'fecha_y_hora' || key === 'fecha') return new Date();
    if (key === 'direccion') return direccion;
    if (key === 'localidad') return localidad;
    if (key === 'codigo_area') return codigoArea;
    if (key === 'celular') return celular;
    if (key === 'telefono_completo') return telefonoCompleto;
    if (key === 'comentario') return comentario;
    if (key === 'origen') return 'WEB_ALTAS';
    if (key === 'estado') return 'NUEVO';
    return '';
  });

  sh.appendRow(row);

  return { ok: true };
}

function getOrCreateAltasSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEETS.ALTAS);
  if (!sh) {
    sh = ss.insertSheet(SHEETS.ALTAS);
  }

  if (sh.getLastRow() === 0) {
    sh.appendRow([
      'Fecha y hora',
      'Direccion',
      'Localidad',
      'Codigo area',
      'Celular',
      'Telefono completo',
      'Comentario',
      'Origen',
      'Estado',
    ]);
  }

  ensureAltasComentarioColumn_(sh);

  return sh;
}

function setupAltasAutomaticasManual() {
  const sh = getOrCreateAltasSheet_();
  applyAltasSheetLayout_(sh);
  ensureAltasDropdowns_(sh);
}

function applyAltasSheetLayout_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 9);

  sheet.setFrozenRows(1);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, 1, lastCol).createFilter();
  }

  const header = sheet.getRange(1, 1, 1, lastCol);
  header
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#0b57d0')
    .setHorizontalAlignment('center');

  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.setColumnWidth(1, 150); // Fecha y hora
  sheet.setColumnWidth(2, 320); // Direccion
  sheet.setColumnWidth(3, 170); // Localidad
  sheet.setColumnWidth(4, 120); // Codigo area
  sheet.setColumnWidth(5, 140); // Celular
  sheet.setColumnWidth(6, 160); // Telefono completo
  sheet.setColumnWidth(7, 280); // Comentario
  sheet.setColumnWidth(8, 130); // Origen
  sheet.setColumnWidth(9, 180); // Estado

  // Intercalado de colores para lectura (blanco + celeste suave).
  const bodyRows = Math.max(sheet.getMaxRows() - 1, 1);
  const bodyRange = sheet.getRange(2, 1, bodyRows, lastCol);
  const existingBandings = sheet.getBandings() || [];
  existingBandings.forEach(function (b) { b.remove(); });
  const banding = bodyRange.applyRowBanding(SpreadsheetApp.BandingTheme.BLUE);
  // Igualado al look de la hoja Pedidos: blanco + azul grisaceo mas marcado.
  banding.setFirstRowColor('#ffffff');
  banding.setSecondRowColor('#d6e1ef');
}

function ensureAltasDropdowns_(sheet) {
  const totalRows = Math.max(sheet.getMaxRows(), 2);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const localidadCol = headers.indexOf('localidad') + 1;
  const estadoCol = headers.indexOf('estado') + 1;

  // Localidad: tomada de Clientes (valores + validacion si existe).
  const localidades = getLocalidadesFromClientes_();
  if (localidadCol > 0 && localidades.length) {
    const localidadRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(localidades, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, localidadCol, totalRows - 1, 1).setDataValidation(localidadRule);
  }

  // Estado operativo para seguimiento telefonico.
  const estadoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS_ALTA, true)
    .setAllowInvalid(false)
    .build();
  if (estadoCol > 0) {
    sheet.getRange(2, estadoCol, totalRows - 1, 1).setDataValidation(estadoRule);
  }
}

function ensureAltasComentarioColumn_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headersRaw = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headers = headersRaw.map(normalizeHeader_);
  if (headers.indexOf('comentario') !== -1) return;

  const telefonoCol = headers.indexOf('telefono_completo') + 1;
  const insertAfter = telefonoCol > 0 ? telefonoCol : lastCol;
  sheet.insertColumnAfter(insertAfter);
  sheet.getRange(1, insertAfter + 1).setValue('Comentario');
}

function getLocalidadesFromClientes_() {
  const unique = {};
  const clientesSheet = getSheet_(SHEETS.CLIENTES);
  const clientes = mapByHeaders_(clientesSheet);

  // 1) Localidades ya cargadas en filas de Clientes.
  clientes.forEach(function (c) {
    const loc = String(c.localidad || '').trim();
    if (!loc) return;
    const key = normalize_(loc);
    if (!unique[key]) unique[key] = loc;
  });

  // 2) Si la hoja Clientes ya tiene dropdown en Localidad, reutilizar esa lista.
  const headers = clientesSheet.getRange(1, 1, 1, clientesSheet.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const localidadCol = headers.indexOf('localidad') + 1;
  if (localidadCol > 0 && clientesSheet.getMaxRows() >= 2) {
    const rule = clientesSheet.getRange(2, localidadCol).getDataValidation();
    if (rule) {
      const criteria = rule.getCriteriaType();
      const values = rule.getCriteriaValues() || [];
      if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST && values[0]) {
        values[0].forEach(function (item) {
          const loc = String(item || '').trim();
          if (!loc) return;
          const key = normalize_(loc);
          if (!unique[key]) unique[key] = loc;
        });
      }
      if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && values[0]) {
        const rangeValues = values[0].getValues().flat();
        rangeValues.forEach(function (item) {
          const loc = String(item || '').trim();
          if (!loc) return;
          const key = normalize_(loc);
          if (!unique[key]) unique[key] = loc;
        });
      }
    }
  }

  const sanitized = sanitizeAltasLocalidades_(Object.keys(unique).map(function (k) { return unique[k]; }));
  return sanitized
    .sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

function sanitizeAltasLocalidades_(localidades) {
  const byKey = {};
  (localidades || []).forEach(function (item) {
    const raw = String(item || '').trim();
    if (!raw) return;
    const key = normalize_(raw);
    if (!key || key === 'BUENOS AIRES') return;
    const finalValue = key === 'CRUZECITA' ? 'Crucecita' : raw;
    byKey[normalize_(finalValue)] = finalValue;
  });
  byKey[normalize_('Crucecita')] = 'Crucecita';
  byKey[normalize_('Turdera')] = 'Turdera';
  return Object.keys(byKey).map(function (k) { return byKey[k]; });
}

function jsonResponse(data, statusCode) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}





