const express = require('express');
const cors = require('cors');
const path = require('path');

// Importación de rutas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/usuarios.routes');
const cursosRoutes = require('./routes/cursos.routes');
const proyectosRoutes = require('./routes/proyectos.routes');
const notasRoutes = require('./routes/notas.routes');
const reportesRoutes = require('./routes/reportes.routes');
const archivoFinalRoutes = require('./routes/archivoFinal.routes');
const docenteRoutes = require('./routes/docente.routes');

const app = express();

// =========================
// MIDDLEWARES
// =========================
app.use(cors());
app.use(express.json());

// =========================
// ARCHIVOS ESTÁTICOS
// =========================

// Servir frontend HTML (carpeta public)
app.use(express.static(path.join(dirname, '../public')));

// Servir archivos subidos
app.use('/uploads', express.static(path.join(dirname, 'uploads')));

// =========================
// RUTA RAÍZ (IMPORTANTE)
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// =========================
// RUTAS API
// =========================
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/notas', notasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/archivo-final', archivoFinalRoutes);
app.use('/api/docente', docenteRoutes);

module.exports = app;