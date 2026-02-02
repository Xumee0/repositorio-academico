function $(id){ return document.getElementById(id); }

function toast(title, message){
  const t = $('toastBox');   // ✅ antes era 'toast'
  if(!t) return;

  $('toastTitle').textContent = title;
  $('toastMsg').textContent = message;

  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3200);
}

// Roles "admin", "secretaria", etc.
function requireAuth(...allowedRoles){
  const token = localStorage.getItem('token');
  const rol = localStorage.getItem('rol');

  if(!token || !rol){
    window.location.replace('login.html');
    return null;
  }

  if(allowedRoles.length && !allowedRoles.includes(rol)){
    window.location.replace('login.html');
    return null;
  }

  return { token, rol };
}

function statusBadge(estado){
  if(estado === 'finalizado') return `<span class="badge ok">Finalizado</span>`;
  if(estado === 'en_proceso') return `<span class="badge warn">En proceso</span>`;
  if(estado === 'pendiente') return `<span class="badge info">Pendiente</span>`;
  return `<span class="badge info">${estado || '—'}</span>`;
}
function setTheme(mode){
  // mode: 'dark' | 'light'
  const m = mode === 'light' ? 'light' : 'dark';
  if(m === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');
  localStorage.setItem('theme', m);
}

function initTheme(){
  const saved = localStorage.getItem('theme') || 'dark';
  setTheme(saved);
}

function toggleTheme(){
  const isLight = document.body.classList.contains('light');
  setTheme(isLight ? 'dark' : 'light');
  toast('Tema', isLight ? 'Modo oscuro activado' : 'Modo claro activado');
}
