const db = require('../config/database');

exports.guardarNota = async (req, res) => {
  try {
    if (req.user.rol !== 'tutor') {
      return res.status(403).json({ msg: 'Solo tutor pueden calificar' });
    }

    const { proyecto_id, calificacion, observaciones } = req.body;
    const tutor_id = req.user.id;

    if (!proyecto_id || calificacion === undefined) {
      return res.status(400).json({ msg: 'Faltan datos (proyecto_id, calificacion)' });
    }

    // Verificar que el proyecto exista y que el curso esté asignado al tutor
    const [[proyecto]] = await db.query(
      'SELECT curso_id, estudiante_id FROM proyectos WHERE id=? AND eliminado=0',
      [proyecto_id]
    );
    if (!proyecto) return res.status(404).json({ msg: 'Proyecto no existe' });

    const [[asignado]] = await db.query(
      'SELECT id FROM tutor_curso WHERE tutor_id=? AND curso_id=?',
      [tutor_id, proyecto.curso_id]
    );
    if (!asignado) return res.status(403).json({ msg: 'No tienes asignado este curso' });

    // INSERT o UPDATE automático (por UNIQUE uq_nota_tutor_proyecto)
    await db.query(
      `
      INSERT INTO notas (proyecto_id, tutor_id, calificacion, observaciones)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        calificacion = VALUES(calificacion),
        observaciones = VALUES(observaciones),
        updated_at = CURRENT_TIMESTAMP
      `,
      [proyecto_id, tutor_id, calificacion, observaciones || null]
    );

    // (Opcional) marcar estado aprobado si quieres que la nota "cierre" el proyecto
    // await db.query(`UPDATE proyectos SET estado='aprobado', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [proyecto_id]);

    res.json({ msg: 'Nota guardada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al guardar nota' });
  }
};

exports.verNotasProyecto = async (req, res) => {
  try {
    const proyecto_id = req.params.id;
    const { id: userId, rol } = req.user;

    const [[proyecto]] = await db.query(
      'SELECT estudiante_id, curso_id FROM proyectos WHERE id=? AND eliminado=0',
      [proyecto_id]
    );
    if (!proyecto) return res.status(404).json({ msg: 'Proyecto no existe' });

    // Permisos:
    // - estudiante: solo su proyecto
    // - tutor: solo si está asignado al curso
    // - admin/secretaria: todo
    if (rol === 'estudiante' && proyecto.estudiante_id !== userId) {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    if (rol === 'tutor') {
      const [[asignado]] = await db.query(
        'SELECT id FROM tutor_curso WHERE tutor_id=? AND curso_id=?',
        [userId, proyecto.curso_id]
      );
      if (!asignado) return res.status(403).json({ msg: 'No autorizado' });
    }

    if (!['admin','secretaria','tutor','estudiante'].includes(rol)) {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    const [rows] = await db.query(
      `
      SELECT 
        n.id,
        n.calificacion,
        n.observaciones,
        DATE_FORMAT(n.updated_at, '%Y-%m-%d %H:%i') AS fecha,
        u.nombre AS tutor
      FROM notas n
      JOIN usuarios u ON u.id = n.tutor_id
      WHERE n.proyecto_id = ?
      ORDER BY n.updated_at DESC
      `,
      [proyecto_id]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener notas' });
  }
};
