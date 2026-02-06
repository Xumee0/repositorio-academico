// =========================
// CONFIGURACIÓN API
// =========================

// Ruta relativa → funciona en local y en producción
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(t) {
  localStorage.setItem('token', t);
}

async function apiFetch(
  path,
  { method = 'GET', headers = {}, body = null, isForm = false } = {}
) {
  const h = { ...headers };

  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;

  if (!isForm && body && typeof body !== 'string') {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body
  });

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.msg || `Error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('rol');
  window.location.href = 'index.html';
  // Redirigir al login
}