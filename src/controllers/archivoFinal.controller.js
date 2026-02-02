const multer = require('multer');
const path = require('path');
const db = require('../config/database');

const storage = multer.diskStorage({
  destination: 'src/uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

exports.upload = multer({ storage }).single('archivo');

exports.subirOReemplazar = async (req, res) => {
  try {
    if (req.user.rol !== 'estudiante') {
      return res.status(403).json({ msg: 'Solo estudiantes pueden subir el proyecto final' });
    }

    const { proyecto_id, nombre_visible } = req.body;
    if (!proyecto_id) return res.status(400).json({ msg: 'Falta proyecto_id' });
    if (!req.file) return res.status(400).json({ msg: 'Falta archivo' });

    const [[p]] = await db.query(
      'SELECT id, estudiante_id FROM proyectos WHERE id=? AND eliminado=0',
      [proyecto_id]
    );
    if (!p) return res.status(404).json({ msg: 'Proyecto no existe' });
    if (p.estudiante_id !== req.user.id) return res.status(403).json({ msg: 'No autorizado' });

    const nombreArchivo = req.file.filename;
    const nombreVisible = (nombre_visible && nombre_visible.trim()) || req.file.originalname;

    await db.query(
      `
      INSERT INTO archivo_final
        (proyecto_id, subido_por, nombre_visible, nombre_archivo, mime_type, tamano_bytes, eliminado)
      VALUES (?,?,?,?,?,?,0)
      ON DUPLICATE KEY UPDATE
        subido_por=VALUES(subido_por),
        nombre_visible=VALUES(nombre_visible),
        nombre_archivo=VALUES(nombre_archivo),
        mime_type=VALUES(mime_type),
        tamano_bytes=VALUES(tamano_bytes),
        eliminado=0,
        updated_at=CURRENT_TIMESTAMP
      `,
      [proyecto_id, req.user.id, nombreVisible, nombreArchivo, req.file.mimetype || null, req.file.size || null]
    );

    await db.query(`UPDATE proyectos SET estado='finalizado', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [proyecto_id]);

    res.json({ msg: 'Archivo final guardado/reemplazado', proyecto_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Error al subir archivo final' });
  }
};

exports.renombrar = async (req, res) => {
  try {
    if (req.user.rol !== 'estudiante') return res.status(403).json({ msg: 'Solo estudiantes pueden renombrar' });

    const { proyecto_id } = req.params;
    const { nombre_visible } = req.body;
    if (!nombre_visible?.trim()) return res.status(400).json({ msg: 'Falta nombre_visible' });

    const [[row]] = await db.query(`
      SELECT af.id, p.estudiante_id
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      WHERE af.proyecto_id=? AND af.eliminado=0
    `, [proyecto_id]);

    if (!row) return res.status(404).json({ msg: 'No hay archivo final' });
    if (row.estudiante_id !== req.user.id) return res.status(403).json({ msg: 'No autorizado' });

    await db.query(
      `UPDATE archivo_final SET nombre_visible=?, updated_at=CURRENT_TIMESTAMP WHERE proyecto_id=?`,
      [nombre_visible.trim(), proyecto_id]
    );

    res.json({ msg: 'Nombre actualizado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Error al renombrar' });
  }
};

exports.eliminar = async (req, res) => {
  try {
    if (req.user.rol !== 'estudiante') return res.status(403).json({ msg: 'Solo estudiantes pueden eliminar' });

    const { proyecto_id } = req.params;

    const [[row]] = await db.query(`
      SELECT af.id, p.estudiante_id
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      WHERE af.proyecto_id=? AND af.eliminado=0
    `, [proyecto_id]);

    if (!row) return res.status(404).json({ msg: 'No hay archivo final' });
    if (row.estudiante_id !== req.user.id) return res.status(403).json({ msg: 'No autorizado' });

    await db.query(`UPDATE archivo_final SET eliminado=1, updated_at=CURRENT_TIMESTAMP WHERE proyecto_id=?`, [proyecto_id]);
    await db.query(`UPDATE proyectos SET estado='en_proceso', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [proyecto_id]);

    res.json({ msg: 'Archivo final marcado como eliminado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Error al eliminar' });
  }
};

exports.listar = async (req, res) => {
  try {
    const { id, rol } = req.user;

    if (rol === 'admin' || rol === 'secretaria') {
      const [rows] = await db.query(`
        SELECT af.*, p.titulo AS proyecto_titulo, u.nombre AS estudiante
        FROM archivo_final af
        JOIN proyectos p ON p.id = af.proyecto_id
        JOIN usuarios u ON u.id = p.estudiante_id
        WHERE af.eliminado=0 AND p.eliminado=0
        ORDER BY af.updated_at DESC, af.created_at DESC
      `);
      return res.json(rows);
    }

    if (rol === 'docente') {
      const [rows] = await db.query(`
        SELECT af.*, p.titulo AS proyecto_titulo, u.nombre AS estudiante
        FROM archivo_final af
        JOIN proyectos p ON p.id = af.proyecto_id
        JOIN usuarios u ON u.id = p.estudiante_id
        JOIN docente_curso dc ON dc.curso_id = p.curso_id
        WHERE dc.docente_id=? AND af.eliminado=0 AND p.eliminado=0
        ORDER BY af.updated_at DESC, af.created_at DESC
      `, [id]);
      return res.json(rows);
    }

    const [rows] = await db.query(`
      SELECT af.*, p.titulo AS proyecto_titulo
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      WHERE p.estudiante_id=? AND af.eliminado=0 AND p.eliminado=0
      ORDER BY af.updated_at DESC, af.created_at DESC
    `, [id]);

    return res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Error al listar archivo final' });
  }
};
