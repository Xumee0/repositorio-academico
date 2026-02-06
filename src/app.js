const express = require('express');
const cors = require('cors');
const path = require('path');

// Importación de rutas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/usuarios.routes');
const proyectosRoutes = require('./routes/proyectos.routes');
const notasRoutes = require('./routes/notas.routes');
const archivoFinalRoutes = require('./routes/archivoFinal.routes');
// Agregar nueva ruta
const descargasRoutes = require('./routes/descargas.routes');
const tutoresRoutes = require('./routes/tutores.routes');
const promocionesRoutes = require('./routes/promociones.routes');

const app = express();

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

// Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/notas', notasRoutes);
app.use('/api/archivo-final', archivoFinalRoutes);


// ... después de las demás rutas
app.use('/api/descargas', descargasRoutes);
app.use('/api/tutores', tutoresRoutes);
app.use('/api/promociones', promocionesRoutes);

module.exports = app;