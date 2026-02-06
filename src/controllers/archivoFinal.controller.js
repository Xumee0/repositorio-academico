const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

// =====================================================
// ✅ CONSTANTE GLOBAL PARA UPLOADS (VOLUMEN RAILWAY)
// =====================================================
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : '/app/backend/src/uploads';

// Asegurar que exista el directorio
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

console.log('UPLOADS_DIR =>', UPLOADS_DIR);

// =====================================================
// ✅ MULTER GUARDANDO EN EL DIRECTORIO CORRECTO
// =====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

exports.upload = multer({ storage }).single('archivo');

exports.subirOReemplazar = async (req, res) => {
  try {
    const { rol, id: userId } = req.user;
    const { proyecto_id, nombre_visible } = req.body;

    if (!proyecto_id) return res.status(400).json({ msg: 'Falta proyecto_id' });
    if (!req.file) return res.status(400).json({ msg: 'Falta archivo' });

    const [[proyecto]] = await db.query(
      'SELECT id, tutor_id FROM proyectos WHERE id=? AND eliminado=0',
      [proyecto_id]
    );

    if (!proyecto) {
      return res.status(404).json({ msg: 'Proyecto no existe' });
    }

    let autorizado = false;
    if (rol === 'tutor') {
      autorizado = proyecto.tutor_id === userId;
    } else if (rol === 'admin') {
      autorizado = true;
    }

    if (!autorizado) {
      return res.status(403).json({ msg: 'No tienes permiso para subir archivo a este proyecto' });
    }

    const nombreArchivo = req.file.filename;
    const nombreVisible = (nombre_visible && nombre_visible.trim()) || req.file.originalname;

    await db.query(
      `INSERT INTO archivo_final
        (proyecto_id, subido_por, nombre_visible, nombre_archivo, mime_type, tamano_bytes, eliminado)
      VALUES (?,?,?,?,?,?,0)
      ON DUPLICATE KEY UPDATE
        subido_por=VALUES(subido_por),
        nombre_visible=VALUES(nombre_visible),
        nombre_archivo=VALUES(nombre_archivo),
        mime_type=VALUES(mime_type),
        tamano_bytes=VALUES(tamano_bytes),
        eliminado=0,
        updated_at=CURRENT_TIMESTAMP`,
      [proyecto_id, userId, nombreVisible, nombreArchivo, req.file.mimetype || null, req.file.size || null]
    );

    await db.query(
      `UPDATE proyectos SET estado='finalizado', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [proyecto_id]
    );

    res.json({
      msg: 'Archivo final guardado correctamente',
      proyecto_id,
      nombre_archivo: nombreVisible
    });

  } catch (e) {
    console.error('Error al subir archivo:', e);
    res.status(500).json({ msg: 'Error al subir archivo final' });
  }
};

exports.renombrar = async (req, res) => {
  try {
    const { rol, id: userId } = req.user;
    const { proyecto_id } = req.params;
    const { nombre_visible } = req.body;

    if (!nombre_visible?.trim()) {
      return res.status(400).json({ msg: 'Falta nombre_visible' });
    }

    const [[row]] = await db.query(`
      SELECT af.id, p.tutor_id
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      WHERE af.proyecto_id=? AND af.eliminado=0
    `, [proyecto_id]);

    if (!row) {
      return res.status(404).json({ msg: 'No hay archivo final' });
    }

    let autorizado = false;
    if (rol === 'tutor') autorizado = row.tutor_id === userId;
    else if (rol === 'admin') autorizado = true;

    if (!autorizado) {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    await db.query(
      `UPDATE archivo_final SET nombre_visible=?, updated_at=CURRENT_TIMESTAMP WHERE proyecto_id=?`,
      [nombre_visible.trim(), proyecto_id]
    );

    res.json({ msg: 'Nombre actualizado' });

  } catch (e) {
    console.error('Error al renombrar:', e);
    res.status(500).json({ msg: 'Error al renombrar' });
  }
};

exports.eliminar = async (req, res) => {
  try {
    const { rol, id: userId } = req.user;
    const { proyecto_id } = req.params;

    const [[row]] = await db.query(`
      SELECT af.id, p.tutor_id
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      WHERE af.proyecto_id=? AND af.eliminado=0
    `, [proyecto_id]);

    if (!row) {
      return res.status(404).json({ msg: 'No hay archivo final' });
    }

    let autorizado = false;
    if (rol === 'tutor') autorizado = row.tutor_id === userId;
    else if (rol === 'admin') autorizado = true;

    if (!autorizado) {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    await db.query(
      `UPDATE archivo_final SET eliminado=1, updated_at=CURRENT_TIMESTAMP WHERE proyecto_id=?`,
      [proyecto_id]
    );

    await db.query(
      `UPDATE proyectos SET estado='en_proceso', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [proyecto_id]
    );

    res.json({ msg: 'Archivo eliminado' });

  } catch (e) {
    console.error('Error al eliminar:', e);
    res.status(500).json({ msg: 'Error al eliminar' });
  }
};

exports.listar = async (req, res) => {
  try {
    const { id, rol } = req.user;

    if (rol === 'admin') {
      const [rows] = await db.query(`
        SELECT 
          af.*,
          p.titulo AS proyecto_titulo,
          u_tutor.nombre AS tutor,
          pr.anio AS promocion,
          e.nombre AS especialidad
        FROM archivo_final af
        JOIN proyectos p ON p.id = af.proyecto_id
        JOIN usuarios u_tutor ON u_tutor.id = p.tutor_id
        JOIN promociones pr ON pr.id = p.promocion_id
        JOIN especialidades e ON e.id = p.especialidad_id
        WHERE af.eliminado=0 AND p.eliminado=0
        ORDER BY af.updated_at DESC
      `);
      return res.json(rows);
    }

    if (rol === 'tutor') {
      const [rows] = await db.query(`
        SELECT 
          af.*,
          p.titulo AS proyecto_titulo,
          pr.anio AS promocion,
          e.nombre AS especialidad
        FROM archivo_final af
        JOIN proyectos p ON p.id = af.proyecto_id
        JOIN promociones pr ON pr.id = p.promocion_id
        JOIN especialidades e ON e.id = p.especialidad_id
        WHERE p.tutor_id=? AND af.eliminado=0 AND p.eliminado=0
        ORDER BY af.updated_at DESC
      `, [id]);
      return res.json(rows);
    }

    return res.status(403).json({ msg: 'Acceso denegado' });

  } catch (e) {
    console.error('Error al listar:', e);
    res.status(500).json({ msg: 'Error al listar archivos' });
  }
};
