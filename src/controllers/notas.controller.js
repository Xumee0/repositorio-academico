const db = require('../config/database');

// =====================================================
// GUARDAR/ACTUALIZAR NOTA
// =====================================================
exports.guardarNota = async (req, res) => {
  try {
    if (req.user.rol !== 'tutor') {
      return res.status(403).json({ msg: 'Solo tutores pueden calificar' });
    }

    const { proyecto_id, calificacion, observaciones } = req.body;
    const tutor_id = req.user.id;

    if (!proyecto_id || calificacion === undefined) {
      return res.status(400).json({ msg: 'Faltan datos (proyecto_id, calificacion)' });
    }

    // Verificar que el proyecto existe y pertenece a este tutor
    const [[proyecto]] = await db.query(
      'SELECT id, tutor_id FROM proyectos WHERE id=? AND eliminado=0',
      [proyecto_id]
    );

    if (!proyecto) {
      return res.status(404).json({ msg: 'Proyecto no existe' });
    }

    // El tutor solo puede calificar sus propios proyectos
    if (proyecto.tutor_id !== tutor_id) {
      return res.status(403).json({ msg: 'No tienes permiso para calificar este proyecto' });
    }

    // INSERT o UPDATE automático (por UNIQUE uq_nota_tutor_proyecto)
    await db.query(
      `INSERT INTO notas (proyecto_id, tutor_id, calificacion, observaciones)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        calificacion = VALUES(calificacion),
        observaciones = VALUES(observaciones),
        updated_at = CURRENT_TIMESTAMP`,
      [proyecto_id, tutor_id, calificacion, observaciones || null]
    );

    res.json({ msg: 'Nota guardada correctamente' });

  } catch (error) {
    console.error('Error al guardar nota:', error);
    res.status(500).json({ msg: 'Error al guardar nota' });
  }
};

// =====================================================
// VER NOTAS DE UN PROYECTO
// =====================================================
exports.verNotasProyecto = async (req, res) => {
  try {
    const proyecto_id = req.params.id;
    const { id: userId, rol } = req.user;

    // Verificar que el proyecto existe
    const [[proyecto]] = await db.query(
      'SELECT id, tutor_id FROM proyectos WHERE id=? AND eliminado=0',
      [proyecto_id]
    );

    if (!proyecto) {
      return res.status(404).json({ msg: 'Proyecto no existe' });
    }

    // Permisos:
    // - tutor: solo su proyecto
    // - admin: todos
    if (rol === 'tutor' && proyecto.tutor_id !== userId) {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    if (!['admin', 'tutor'].includes(rol)) {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    // Obtener notas del proyecto
    const [rows] = await db.query(
      `SELECT 
        n.id,
        n.calificacion,
        n.observaciones,
        DATE_FORMAT(n.updated_at, '%Y-%m-%d %H:%i') AS fecha,
        u.nombre AS tutor
      FROM notas n
      JOIN usuarios u ON u.id = n.tutor_id
      WHERE n.proyecto_id = ?
      ORDER BY n.updated_at DESC`,
      [proyecto_id]
    );

    res.json(rows);

  } catch (error) {
    console.error('Error al obtener notas:', error);
    res.status(500).json({ msg: 'Error al obtener notas' });
  }
};