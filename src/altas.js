import { API_BASE_URL } from "./config.js?v=20260520-1";

const form = document.getElementById("alta-form");
const submitBtn = document.getElementById("alta-submit");
const feedback = document.getElementById("alta-feedback");
const direccionInput = document.getElementById("alta-direccion");
const localidadInput = document.getElementById("alta-localidad");
const telefonoInput = document.getElementById("alta-telefono");
const comentarioInput = document.getElementById("alta-comentario");
let allowedLocalidades = [];
let submitLockedAfterSuccess = false;

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function splitPhoneParts(value) {
  const digits = onlyDigits(value);
  if (!digits) return { codigo_area: "", celular: "", telefono_completo: "" };
  if (digits.length <= 8) {
    return { codigo_area: "", celular: digits, telefono_completo: digits };
  }
  const codigo_area = digits.slice(0, digits.length - 8);
  const celular = digits.slice(-8);
  return { codigo_area, celular, telefono_completo: digits };
}

function setFeedback(message, isError) {
  if (!feedback) return;
  feedback.textContent = message || "";
  feedback.classList.toggle("is-visible", Boolean(message));
  feedback.classList.toggle("is-error", Boolean(message) && Boolean(isError));
  feedback.classList.toggle("is-success", Boolean(message) && !isError);
}

function resetSubmitState() {
  if (!submitBtn) return;
  submitLockedAfterSuccess = false;
  submitBtn.disabled = false;
  submitBtn.textContent = "Enviar solicitud";
}

function lockSubmitAfterSuccess() {
  if (!submitBtn) return;
  submitLockedAfterSuccess = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Solicitud enviada";
}

function normalizeLocalidad(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sanitizeLocalidades(localidades) {
  const byKey = new Map();
  (localidades || []).forEach((item) => {
    const raw = String(item || "").trim();
    if (!raw) return;
    const normalized = normalizeLocalidad(raw);
    if (!normalized || normalized === "BUENOS AIRES") return;
    const finalValue = normalized === normalizeLocalidad("CRUCESITA") ? "CRUCECITA" : normalized;
    byKey.set(normalizeLocalidad(finalValue), finalValue);
  });
  byKey.set(normalizeLocalidad("CRUCECITA"), "CRUCECITA");
  byKey.set(normalizeLocalidad("TURDERA"), "TURDERA");
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, "es"));
}

function renderLocalidadesOptions(localidades) {
  if (!localidadInput) return;
  localidadInput.innerHTML = [
    '<option value="">Seleccion\u00e1 tu localidad</option>',
    ...localidades.map((loc) => `<option value="${String(loc).replace(/"/g, "&quot;")}">${loc}</option>`),
  ].join("");
}

async function api(path, payload) {
  const res = await fetch(`${API_BASE_URL}?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error API");
  return res.json();
}

async function preloadLocalidades() {
  if (!API_BASE_URL || !localidadInput) return;
  try {
    const response = await api("getLocalidades", {});
    const localidades = sanitizeLocalidades(Array.isArray(response?.localidades) ? response.localidades : []);
    allowedLocalidades = localidades.map((loc) => normalizeLocalidad(loc));
    renderLocalidadesOptions(localidades);
  } catch (_err) {
    setFeedback("No pudimos cargar las localidades. Prob\u00e1 de nuevo en unos minutos.", true);
  }
}

if (telefonoInput) {
  telefonoInput.addEventListener("input", () => {
    telefonoInput.value = onlyDigits(telefonoInput.value).slice(0, 10);
  });
}

if (form) {
  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      if (!submitLockedAfterSuccess) return;
      setFeedback("", false);
      resetSubmitState();
    });
    field.addEventListener("change", () => {
      if (!submitLockedAfterSuccess) return;
      setFeedback("", false);
      resetSubmitState();
    });
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback("", false);

    const direccion = String(direccionInput?.value || "").trim();
    const localidad = String(localidadInput?.value || "").trim();
    const telefono = onlyDigits(telefonoInput?.value || "");
    const comentario = String(comentarioInput?.value || "").trim();
    const { codigo_area, celular } = splitPhoneParts(telefono);

    if (!direccion || !localidad || !telefono) {
      setFeedback("Complet\u00e1 todos los campos para continuar.", true);
      return;
    }

    if (telefono.length < 10) {
      setFeedback("Ingres\u00e1 el tel\u00e9fono completo, incluyendo c\u00f3digo de \u00e1rea, sin 0 ni 15.", true);
      return;
    }

    if (allowedLocalidades.length && !allowedLocalidades.includes(normalizeLocalidad(localidad))) {
      setFeedback("Seleccion\u00e1 una localidad v\u00e1lida del men\u00fa desplegable.", true);
      return;
    }

    if (!API_BASE_URL) {
      setFeedback("Falta configurar API_BASE_URL para guardar en Google Sheets.", true);
      return;
    }

    submitBtn.disabled = true;
    const prev = submitBtn.textContent;
    submitBtn.textContent = "Enviando...";

    try {
      const result = await api("createLead", { direccion, localidad, codigo_area, celular, comentario });
      if (!result?.ok) throw new Error(result?.error || "No se pudo guardar");
      form.reset();
      setFeedback("Solicitud enviada con \u00e9xito. Ya recibimos tus datos y te vamos a contactar a la brevedad.", false);
      lockSubmitAfterSuccess();
    } catch (_err) {
      setFeedback("No pudimos enviar la solicitud. Prob\u00e1 de nuevo en unos minutos.", true);
    } finally {
      if (!submitLockedAfterSuccess) {
        submitBtn.disabled = false;
        submitBtn.textContent = prev;
      }
    }
  });
}

preloadLocalidades();
