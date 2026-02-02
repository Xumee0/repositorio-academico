const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/usuarios.routes');
const cursosRoutes = require('./routes/cursos.routes');
const proyectosRoutes = require('./routes/proyectos.routes');



const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('src/uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/archivo-final', require('./routes/archivoFinal.routes'));
app.use('/api/docente', require('./routes/docente.routes'));


// Conexion de notas
const notasRoutes = require('./routes/notas.routes');
app.use('/api/notas', notasRoutes);

//Conexion de reportes
const reportesRoutes = require('./routes/reportes.routes');
app.use('/api/reportes', reportesRoutes);

module.exports = app;

