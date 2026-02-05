const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

// Listar proyectos según el rol
router.get('/', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;

    // Admin: todos los proyectos
    if (rol === 'admin') {
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.titulo AS tema_proyecto,
          p.descripcion,
          p.estado,
          p.created_at,
          CONCAT(c.nombre,' ',c.paralelo) AS curso,
          e.nombre AS especialidad,
          pr.anio AS promocion,
          u.nombre AS tutor,
          af.nombre_archivo,
          af.nombre_visible
        FROM proyectos p
        JOIN cursos c ON c.id = p.curso_id
        JOIN especialidades e ON e.id = c.especialidad_id
        JOIN promociones pr ON pr.id = c.promocion_id
        JOIN usuarios u ON u.id = p.tutor_id
        LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
        WHERE p.eliminado = 0
        ORDER BY pr.anio DESC, e.nombre, p.titulo
      `);
      return res.json(rows);
    }

    // Tutor: proyectos de sus cursos
    if (rol === 'tutor') {
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.titulo AS tema_proyecto,
          p.descripcion,
          p.estado,
          p.created_at,
          CONCAT(c.nombre,' ',c.paralelo) AS curso,
          e.nombre AS especialidad,
          pr.anio AS promocion,
          af.nombre_archivo,
          af.nombre_visible
        FROM proyectos p
        JOIN cursos c ON c.id = p.curso_id
        JOIN tutor_curso tc ON tc.curso_id = c.id
        JOIN especialidades e ON e.id = c.especialidad_id
        JOIN promociones pr ON pr.id = c.promocion_id
        LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
        WHERE tc.tutor_id = ? AND p.eliminado = 0
        ORDER BY pr.anio DESC, e.nombre, p.titulo
      `, [id]);
      return res.json(rows);
    }

    res.status(403).json({ msg: 'Acceso denegado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al listar proyectos' });
  }
});

// Crear nuevo proyecto (solo tutores)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;
    const { curso_id, titulo, descripcion } = req.body;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Solo tutores pueden crear proyectos' });
    }

    if (!curso_id || !titulo) {
      return res.status(400).json({ msg: 'Faltan datos requeridos' });
    }

    // Verificar que el tutor tiene acceso al curso
    if (rol === 'tutor') {
      const [[acceso]] = await db.query(
        'SELECT 1 FROM tutor_curso WHERE tutor_id=? AND curso_id=?',
        [id, curso_id]
      );
      if (!acceso) {
        return res.status(403).json({ msg: 'No tienes acceso a este curso' });
      }
    }

    const [result] = await db.query(`
      INSERT INTO proyectos (curso_id, tutor_id, titulo, descripcion)
      VALUES (?, ?, ?, ?)
    `, [curso_id, id, titulo, descripcion || null]);

    res.json({ id: result.insertId, msg: 'Proyecto creado exitosamente' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ msg: 'Ya existe un proyecto con ese título en este curso' });
    }
    res.status(500).json({ msg: 'Error al crear proyecto' });
  }
});

// Actualizar proyecto
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id: userId, rol } = req.user;
    const { id } = req.params;
    const { titulo, descripcion, estado } = req.body;

    // Verificar acceso
    const [[proyecto]] = await db.query(
      'SELECT tutor_id FROM proyectos WHERE id=? AND eliminado=0',
      [id]
    );

    if (!proyecto) {
      return res.status(404).json({ msg: 'Proyecto no encontrado' });
    }

    if (rol === 'tutor' && proyecto.tutor_id !== userId) {
      return res.status(403).json({ msg: 'No tienes permiso para editar este proyecto' });
    }

    await db.query(`
      UPDATE proyectos 
      SET titulo=?, descripcion=?, estado=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [titulo, descripcion || null, estado || 'pendiente', id]);

    res.json({ msg: 'Proyecto actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al actualizar proyecto' });
  }
});

// Eliminar proyecto (soft delete)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id: userId, rol } = req.user;
    const { id } = req.params;

    const [[proyecto]] = await db.query(
      'SELECT tutor_id FROM proyectos WHERE id=? AND eliminado=0',
      [id]
    );

    if (!proyecto) {
      return res.status(404).json({ msg: 'Proyecto no encontrado' });
    }

    if (rol === 'tutor' && proyecto.tutor_id !== userId) {
      return res.status(403).json({ msg: 'No tienes permiso para eliminar este proyecto' });
    }

    await db.query('UPDATE proyectos SET eliminado=1 WHERE id=?', [id]);
    res.json({ msg: 'Proyecto eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al eliminar proyecto' });
  }
});

module.exports = router;