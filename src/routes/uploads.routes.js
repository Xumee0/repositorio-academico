const router = require('express').Router();
const { verifyToken } = require('../middlewares/auth');
const path = require('path');
const fs = require('fs');

// DESCARGAR ARCHIVO CON AUTENTICACIÓN
router.get('/:filename', verifyToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const { rol, id } = req.user;
    
    // Sanitizar nombre de archivo para evitar path traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../uploads', safeFilename);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ msg: 'Archivo no encontrado' });
    }
    
    // Verificar permisos: obtener el proyecto asociado al archivo
    const db = require('../config/database');
    const [[archivo]] = await db.query(`
      SELECT af.*, p.tutor_id
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      WHERE af.nombre_archivo = ? AND af.eliminado = 0
    `, [safeFilename]);
    
    if (!archivo) {
      return res.status(404).json({ msg: 'Archivo no encontrado en la base de datos' });
    }
    
    // Verificar permisos según el rol
    if (rol === 'tutor' && archivo.tutor_id !== id) {
      return res.status(403).json({ msg: 'No tienes permiso para acceder a este archivo' });
    }
    
    // Configurar headers para descarga
    res.setHeader('Content-Type', archivo.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${archivo.nombre_visible || safeFilename}"`);
    
    // Enviar archivo
    res.sendFile(filePath);
    
  } catch (err) {
    console.error('Error al descargar archivo:', err);
    res.status(500).json({ msg: 'Error al descargar archivo' });
  }
});

module.exports = router;