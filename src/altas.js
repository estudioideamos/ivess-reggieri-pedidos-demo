import { API_BASE_URL } from "./config.js?v=20260520-1";

const form = document.getElementById("alta-form");
const submitBtn = document.getElementById("alta-submit");
const feedback = document.getElementById("alta-feedback");
const direccionInput = document.getElementById("alta-direccion");
const localidadInput = document.getElementById("alta-localidad");
const localidadesList = document.getElementById("alta-localidades-list");
const codAreaInput = document.getElementById("alta-cod-area");
const celularInput = document.getElementById("alta-celular");

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function setFeedback(message, isError) {
  if (!feedback) return;
  feedback.textContent = message || "";
  feedback.style.color = isError ? "#ffd2d2" : "#bfffd8";
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
  if (!API_BASE_URL || !localidadesList) return;
  try {
    const response = await api("getLocalidades", {});
    const localidades = Array.isArray(response?.localidades) ? response.localidades : [];
    localidadesList.innerHTML = localidades
      .filter((v) => String(v || "").trim())
      .map((loc) => `<option value="${String(loc).replace(/"/g, "&quot;")}"></option>`)
      .join("");
  } catch (_err) {
    // Si falla, el usuario puede seguir escribiendo manualmente.
  }
}

if (codAreaInput) {
  codAreaInput.addEventListener("input", () => {
    codAreaInput.value = onlyDigits(codAreaInput.value).slice(0, 5);
  });
}

if (celularInput) {
  celularInput.addEventListener("input", () => {
    celularInput.value = onlyDigits(celularInput.value).slice(0, 10);
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback("", false);

    const direccion = String(direccionInput?.value || "").trim();
    const localidad = String(localidadInput?.value || "").trim();
    const codigo_area = onlyDigits(codAreaInput?.value || "");
    const celular = onlyDigits(celularInput?.value || "");

    if (!direccion || !localidad || !codigo_area || !celular) {
      setFeedback("Completá todos los campos para continuar.", true);
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
      const result = await api("createLead", { direccion, localidad, codigo_area, celular });
      if (!result?.ok) throw new Error(result?.error || "No se pudo guardar");
      form.reset();
      setFeedback("Solicitud enviada. Te vamos a contactar a la brevedad.", false);
    } catch (_err) {
      setFeedback("No pudimos enviar la solicitud. Probá de nuevo en unos minutos.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prev;
    }
  });
}

preloadLocalidades();
