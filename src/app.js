const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Importación de rutas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/usuarios.routes');
const proyectosRoutes = require('./routes/proyectos.routes');
const archivoFinalRoutes = require('./routes/archivoFinal.routes');
const descargasRoutes = require('./routes/descargas.routes');
const tutoresRoutes = require('./routes/tutores.routes');
const promocionesRoutes = require('./routes/promociones.routes');

const app = express();

// =========================
// ✅ UPLOADS DIR (MISMO PARA TODO)
// =========================
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : '/app/backend/src/uploads';

// Asegurar carpeta (para Railway volume)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
console.log('APP UPLOADS_DIR =>', UPLOADS_DIR);

// =========================
// MIDDLEWARES
// =========================
app.use(cors());
app.use(express.json());

// =========================
// ARCHIVOS ESTÁTICOS
// =========================

// Frontend HTML
app.use(express.static(path.join(__dirname, '../public')));

// ✅ Uploads (sirve exactamente el volumen)
app.use('/uploads', express.static(UPLOADS_DIR));

// =========================
// RUTA RAÍZ
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// =========================
// RUTAS API
// =========================
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/archivo-final', archivoFinalRoutes);

app.use('/api/descargas', descargasRoutes);
app.use('/api/tutores', tutoresRoutes);
app.use('/api/promociones', promocionesRoutes);

module.exports = app;
