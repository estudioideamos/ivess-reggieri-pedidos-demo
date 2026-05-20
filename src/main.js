import { API_BASE_URL, MOCK_CLIENTS, MOCK_PRODUCTS } from "./config.js?v=20260520-1";

const state = {
  cliente: null,
  horario: "",
  items: {},
  products: [],
};
const catalogCache = new Map();
let productsPromise = null;
const PRODUCT_IMAGE_BY_SKU = {
  BOT20: "./assets/products/bot20.jpeg",
  BOT12: "./assets/products/bot12.jpeg",
  BJS12: "./assets/products/bot12_bajo_sodio.jpg",
  SODA: "./assets/products/soda.png",
  SAB15: "./assets/products/sab15.jpeg",
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const screens = {
  lookup: document.getElementById("screen-lookup"),
  schedule: document.getElementById("screen-schedule"),
  products: document.getElementById("screen-products"),
  confirm: document.getElementById("screen-confirm"),
};

const addressInput = document.getElementById("address-input");
const customerLabel = document.getElementById("customer-label");
const scheduleList = document.getElementById("schedule-list");
const scheduleLoading = document.getElementById("schedule-loading");
const productsList = document.getElementById("products-list");
const totalLabel = document.getElementById("total-label");
const confirmBox = document.getElementById("confirm-box");
const commentInput = document.getElementById("comment-input");
const lookupSpinner = document.getElementById("lookup-spinner");
const stepIndicator = document.getElementById("step-indicator");

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  const target = screens[name];
  target.classList.remove("hidden");
  target.classList.remove("screen-enter");
  void target.offsetWidth;
  target.classList.add("screen-enter");
  updateStepIndicator(name);
}

function updateStepIndicator(screenName) {
  if (!stepIndicator) return;
  const map = {
    lookup: "PASO 1 de 5",
    schedule: "PASO 2 de 5",
    products: "PASO 3 de 5",
    confirm: "PASO 4 de 5",
  };
  stepIndicator.textContent = map[screenName] || "PASO 1 de 5";
}

function setLookupLoading(show) {
  if (!lookupSpinner) return;
  lookupSpinner.classList.toggle("hidden", !show);
}

function setScheduleLoading(show) {
  if (!scheduleLoading) return;
  scheduleLoading.classList.toggle("hidden", !show);
}

function normalize(value) {
  return (value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalAddress(value) {
  const base = normalize(value)
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = base.split(" ").filter(Boolean);
  const stop = new Set(["AV", "AVENIDA", "PASAJE", "PSJE", "CALLE"]);
  return tokens.filter((t) => !stop.has(t)).join(" ");
}

function addressMatches(inputAddress, storedAddress) {
  const query = canonicalAddress(inputAddress);
  const full = canonicalAddress(storedAddress);
  if (!query || !full) return false;
  if (query === full) return true;
  const qTokens = query.split(" ").filter(Boolean);
  const fTokens = full.split(" ").filter(Boolean);
  const qNums = qTokens.filter((t) => /^\d+[A-Z]?$/.test(t));
  if (!qNums.length) return false;
  const hasAllNums = qNums.every((n) => fTokens.includes(n));
  if (!hasAllNums) return false;
  const qWords = qTokens.filter((t) => !/^\d+[A-Z]?$/.test(t));
  return qWords.every((w) => fTokens.includes(w));
}

function beautifyProductName(name) {
  return String(name || "")
    .replace(/Botellon/gi, "Botellón")
    .replace(/Sifon/gi, "Sifón");
}

async function api(path, payload) {
  if (!API_BASE_URL) return null;
  const res = await fetch(`${API_BASE_URL}?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error API");
  return res.json();
}

async function findClient(query) {
  const normalized = normalize(query);
  const byMock = MOCK_CLIENTS.find(
    (c) => addressMatches(query, c.direccion) || normalize(c.telefono) === normalized
  );
  if (API_BASE_URL) {
    try {
      const live = await api("findClient", { query });
      if (live?.found) return live.client;
    } catch (err) {
      console.warn("Fallo findClient en backend, uso datos locales temporales.", err);
    }
  }
  return byMock || null;
}

async function getProductsForClient(cliente) {
  const lista = Number(cliente?.lista_precio || 1) === 2 ? 2 : 1;
  if (catalogCache.has(lista)) return catalogCache.get(lista);
  if (API_BASE_URL) {
    try {
      const live = await api("getCatalog", { lista_precio: lista });
      if (live?.ok && Array.isArray(live.productos)) {
        catalogCache.set(lista, live.productos);
        return live.productos;
      }
    } catch (err) {
      console.warn("Fallo getCatalog en backend, uso catalogo local temporal.", err);
    }
  }
  const fallback = MOCK_PRODUCTS.map((p) => ({
    sku: p.sku,
    nombre: p.nombre,
    precio: lista === 2 ? Number(p.precio_lista_2 || 0) : Number(p.precio_lista_1 || 0),
    image_url: p.image_url || PRODUCT_IMAGE_BY_SKU[p.sku] || "",
  }));
  catalogCache.set(lista, fallback);
  return fallback;
}

function renderSchedules() {
  scheduleList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const accentClasses = ["accent-blue", "accent-green", "accent-violet", "accent-orange", "accent-cyan"];
  const options = [...state.cliente.horarios, "Ninguno, hablar con un asesor"];
  options.forEach((h, idx) => {
    const btn = document.createElement("button");
    const accent = accentClasses[idx % accentClasses.length];
    btn.className = `card card-schedule ${accent}`;
    btn.style.animationDelay = `${0.06 * idx}s`;
    const isAdvisor = normalize(h).includes("ASESOR");
    const icon = isAdvisor ? "./assets/asesor.svg" : "./assets/agenda.svg";
    btn.innerHTML = `
      <span class="schedule-left">
        <span class="schedule-icon-wrap">
          <img src="${icon}" alt="" class="schedule-icon" />
        </span>
        <span class="schedule-text">${h}</span>
      </span>
      <span class="schedule-arrow">›</span>
    `;
    btn.onclick = () => {
      const openProducts = async () => {
        state.horario = h;
        setScheduleLoading(true);
        try {
          if ((!state.products || !state.products.length) && productsPromise) {
            await productsPromise;
          } else if (!state.products || !state.products.length) {
            state.products = await getProductsForClient(state.cliente);
          }
          renderProducts();
          showScreen("products");
        } finally {
          setScheduleLoading(false);
        }
      };
      openProducts();
    };
    fragment.appendChild(btn);
  });
  scheduleList.appendChild(fragment);
}

function renderProducts() {
  productsList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.products.forEach((p) => {
    if (!state.items[p.sku]) state.items[p.sku] = 0;
    const imageUrl = p.image_url || PRODUCT_IMAGE_BY_SKU[p.sku] || "";
    const displayName = beautifyProductName(p.nombre);
    const card = document.createElement("div");
    card.className = "card product";
    card.style.animationDelay = `${0.05 * productsList.children.length}s`;
    card.innerHTML = `
      <div class="product-media">${imageUrl ? `<img src="${imageUrl}" alt="${displayName}" class="product-image" />` : ""}</div>
      <h3>${displayName}</h3>
      <p class="product-price">${currency.format(p.precio)}</p>
      <div class="qty">
        <button data-delta="-1">-</button>
        <span id="qty-${p.sku}">${state.items[p.sku]}</span>
        <button data-delta="1">+</button>
      </div>
    `;
    const buttons = card.querySelectorAll("button");
    buttons.forEach((b) => {
      b.onclick = () => {
        const delta = Number(b.dataset.delta);
        state.items[p.sku] = Math.max(0, state.items[p.sku] + delta);
        const qtyEl = document.getElementById(`qty-${p.sku}`);
        if (qtyEl) qtyEl.textContent = state.items[p.sku];
        updateTotal();
      };
    });
    fragment.appendChild(card);
  });
  productsList.appendChild(fragment);
  updateTotal();
}

function calcTotal() {
  return state.products.reduce((acc, p) => acc + p.precio * (state.items[p.sku] || 0), 0);
}

function updateTotal() {
  totalLabel.textContent = currency.format(calcTotal());
}

function orderSummary() {
  return state.products
    .filter((p) => (state.items[p.sku] || 0) > 0)
    .map((p) => `${state.items[p.sku]} x ${beautifyProductName(p.nombre)}`);
}

async function submitOrder() {
  const submitBtn = document.getElementById("btn-submit");
  const payload = {
    id_cliente: state.cliente.id_cliente,
    direccion: state.cliente.direccion,
    horario: state.horario,
    items: state.items,
    comentario: commentInput.value.trim(),
    total: calcTotal(),
    lista_precio: Number(state.cliente?.lista_precio || 1),
  };

  if (API_BASE_URL) {
    const prev = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";
    try {
      await api("createOrder", payload);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prev;
    }
  }

  confirmBox.innerHTML = `
    <div class="confirm-top">
      <span class="confirm-top-icon-wrap"><img src="./assets/marca-de-verificacion.svg" alt="" class="confirm-top-icon" /></span>
      <div class="confirm-status">Muchas gracias.<br />Pedido realizado con exito.</div>
    </div>
    <div class="confirm-row">
      <span class="confirm-icon-circle"><img src="./assets/logistica.svg" alt="" class="confirm-row-icon" /></span>
      <p><span class="confirm-label">Pedido:</span><br /><span class="confirm-value">${orderSummary().length ? orderSummary().join(" | ") : "Sin productos"}</span></p>
    </div>
    <div class="confirm-row">
      <span class="confirm-icon-circle"><img src="./assets/mapas-y-banderas-confirm.svg" alt="" class="confirm-row-icon" /></span>
      <p><span class="confirm-label">Dirección de entrega:</span><br /><span class="confirm-value">${state.cliente.direccion}</span></p>
    </div>
    <div class="confirm-row">
      <span class="confirm-icon-circle"><img src="./assets/reloj-circular.svg" alt="" class="confirm-row-icon" /></span>
      <p><span class="confirm-label">Horario de entrega:</span><br /><span class="confirm-value">${state.horario}</span></p>
    </div>
    <div class="confirm-row">
      <span class="confirm-icon-circle"><img src="./assets/billete-de-banco.svg" alt="" class="confirm-row-icon" /></span>
      <p><span class="confirm-label">Monto total:</span><br /><span class="confirm-value">${currency.format(calcTotal())}</span></p>
    </div>
    <div class="confirm-payline"></div>
    <div class="confirm-pay-row">
      <p class="confirm-pay-text"><img src="./assets/billetera.svg" alt="" class="confirm-pay-icon" /> Podes abonar ahora o en el momento de entrega.<br />En efectivo o por transferencia al alias: <strong>Reggieri.SA</strong></p>
      <button id="btn-copy-alias" type="button" class="confirm-copy-btn">Copiar alias</button>
    </div>
    <div class="confirm-note"><span>Ante cualquier consulta siempre podes <strong>hablar con un asesor</strong>.</span></div>
  `;
  const copyBtn = document.getElementById("btn-copy-alias");
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText("Reggieri.SA");
        copyBtn.textContent = "Alias copiado";
        setTimeout(() => { copyBtn.textContent = "Copiar alias"; }, 1300);
      } catch (_) {
        copyBtn.textContent = "No se pudo copiar";
        setTimeout(() => { copyBtn.textContent = "Copiar alias"; }, 1300);
      }
    };
  }
  showScreen("confirm");
}

document.getElementById("btn-find").onclick = async () => {
  const btn = document.getElementById("btn-find");
  const query = addressInput.value.trim();
  if (!query) return;
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Buscando...";
  setLookupLoading(true);
  try {
    const found = await findClient(query);
    if (!found) {
      alert("No encontramos cliente con esa dirección/teléfono.");
      return;
    }
    const q = normalize(query);
    const exactAddress = addressMatches(query, found.direccion);
    const exactPhone = normalize(found.telefono) === q;
    if (!exactAddress && !exactPhone) {
      alert("Ingresá la dirección completa o el teléfono exacto para continuar.");
      return;
    }
    state.cliente = found;
    state.products = [];
    productsPromise = getProductsForClient(found).then((catalog) => {
      state.products = catalog;
      return catalog;
    });
    customerLabel.textContent = `Nro. de Cliente ${found.id_cliente} - ${found.direccion}`;
    renderSchedules();
    showScreen("schedule");
  } catch (err) {
    console.error(err);
    alert("Hubo un error buscando el cliente. Probá nuevamente.");
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
    setLookupLoading(false);
  }
};

document.getElementById("btn-back-lookup").onclick = () => showScreen("lookup");
document.getElementById("btn-back-schedule").onclick = () => showScreen("schedule");
document.getElementById("btn-submit").onclick = submitOrder;

document.getElementById("btn-new-order").onclick = () => {
  state.cliente = null;
  state.horario = "";
  state.items = {};
  state.products = [];
  commentInput.value = "";
  addressInput.value = "";
  showScreen("lookup");
};

showScreen("lookup");

