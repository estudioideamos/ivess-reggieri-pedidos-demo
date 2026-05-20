import { API_BASE_URL, MOCK_CLIENTS, MOCK_PRODUCTS } from "./config.js?v=20260520-1";

const state = {
  cliente: null,
  horario: "",
  items: {},
  products: [],
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
const productsList = document.getElementById("products-list");
const totalLabel = document.getElementById("total-label");
const confirmBox = document.getElementById("confirm-box");
const commentInput = document.getElementById("comment-input");
const addressSuggestions = document.getElementById("address-suggestions");

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function normalize(value) {
  return (value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function api(path, payload) {
  if (!API_BASE_URL) return null;
  const res = await fetch(`${API_BASE_URL}?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error API");
  return res.json();
}

async function findClient(query) {
  const normalized = normalize(query);
  const byMock = MOCK_CLIENTS.find(
    (c) => normalize(c.direccion).includes(normalized) || normalize(c.telefono) === normalized
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

async function loadAddressSuggestions() {
  let addresses = [];
  if (API_BASE_URL) {
    try {
      const live = await api("getAddressBook", {});
      if (live?.ok && Array.isArray(live.direcciones)) {
        addresses = live.direcciones;
      }
    } catch (err) {
      console.warn("Fallo getAddressBook en backend, uso sugerencias locales.", err);
    }
  }

  if (!addresses.length) {
    addresses = MOCK_CLIENTS.map((c) => c.direccion);
  }

  const unique = addresses
    .map((a) => String(a || "").trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a.localeCompare(b, "es"));

  if (!addressSuggestions) return;
  addressSuggestions.innerHTML = "";
  unique.forEach((a) => {
    const option = document.createElement("option");
    option.value = a;
    addressSuggestions.appendChild(option);
  });
}

async function getProductsForClient(cliente) {
  const lista = Number(cliente?.lista_precio || 1) === 2 ? 2 : 1;
  if (API_BASE_URL) {
    try {
      const live = await api("getCatalog", { lista_precio: lista });
      if (live?.ok && Array.isArray(live.productos)) {
        return live.productos;
      }
    } catch (err) {
      console.warn("Fallo getCatalog en backend, uso catalogo local temporal.", err);
    }
  }
  return MOCK_PRODUCTS.map((p) => ({
    sku: p.sku,
    nombre: p.nombre,
    precio: lista === 2 ? Number(p.precio_lista_2 || 0) : Number(p.precio_lista_1 || 0),
  }));
}

function renderSchedules() {
  scheduleList.innerHTML = "";
  const accentClasses = ["accent-blue", "accent-green", "accent-violet", "accent-orange", "accent-cyan"];
  const options = [...state.cliente.horarios, "Ninguno, hablar con un asesor"];
  options.forEach((h, idx) => {
    const btn = document.createElement("button");
    const accent = accentClasses[idx % accentClasses.length];
    btn.className = `card card-schedule ${accent}`;
    btn.innerHTML = `
      <span class="schedule-left">
        <span class="schedule-icon-wrap">
          <img src="./assets/agenda.svg" alt="" class="schedule-icon" />
        </span>
        <span class="schedule-text">${h}</span>
      </span>
      <span class="schedule-arrow">›</span>
    `;
    btn.onclick = () => {
      state.horario = h;
      renderProducts();
      showScreen("products");
    };
    scheduleList.appendChild(btn);
  });
}

function renderProducts() {
  productsList.innerHTML = "";
  state.products.forEach((p) => {
    if (!state.items[p.sku]) state.items[p.sku] = 0;
    const card = document.createElement("div");
    card.className = "card product";
    card.innerHTML = `
      <h3>${p.nombre}</h3>
      <p>${currency.format(p.precio)}</p>
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
        document.getElementById(`qty-${p.sku}`).textContent = state.items[p.sku];
        updateTotal();
      };
    });
    productsList.appendChild(card);
  });
  updateTotal();
}

function calcTotal() {
  return state.products.reduce((acc, p) => acc + p.precio * (state.items[p.sku] || 0), 0);
}

function updateTotal() {
  totalLabel.textContent = currency.format(calcTotal());
}

function orderSummary() {
  const lines = state.products
    .filter((p) => (state.items[p.sku] || 0) > 0)
    .map((p) => `${state.items[p.sku]} x ${p.nombre}`);
  return lines.length ? lines.join(", ") : "Sin productos";
}

async function submitOrder() {
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
    await api("createOrder", payload);
  }

  confirmBox.innerHTML = `
    <p><strong>Nro de cliente:</strong> ${state.cliente.id_cliente}</p>
    <p><strong>Direccion:</strong> ${state.cliente.direccion}</p>
    <p><strong>Horario:</strong> ${state.horario}</p>
    <p><strong>Pedido:</strong> ${orderSummary()}</p>
    <p><strong>Total:</strong> ${currency.format(calcTotal())}</p>
  `;
  showScreen("confirm");
}

document.getElementById("btn-find").onclick = async () => {
  const query = addressInput.value.trim();
  if (!query) return;
  const found = await findClient(query);
  if (!found) {
    alert("No encontramos cliente con esa direccion/telefono.");
    return;
  }
  state.cliente = found;
  state.products = await getProductsForClient(found);
  customerLabel.textContent = `Nro ${found.id_cliente} - ${found.direccion}`;
  renderSchedules();
  showScreen("schedule");
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
loadAddressSuggestions();

