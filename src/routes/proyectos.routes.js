const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

// =====================================================
// LISTAR PROYECTOS SEGÚN ROL
// =====================================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;

    // Admin y Tutor: todos los proyectos
    if (rol === 'admin' || rol === 'tutor') {
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.titulo AS tema_proyecto,
          p.descripcion,
          p.estado,
          p.created_at,
          pr.anio AS promocion,
          e.nombre AS especialidad,
          u.nombre AS tutor,
          af.nombre_archivo,
          af.nombre_visible
        FROM proyectos p
        JOIN promociones pr ON pr.id = p.promocion_id
        JOIN especialidades e ON e.id = p.especialidad_id
        JOIN usuarios u ON u.id = p.tutor_id
        LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
        WHERE p.eliminado = 0
        ORDER BY pr.anio DESC, e.nombre, p.titulo
      `);
      return res.json(rows);
    }

    res.status(403).json({ msg: 'Acceso denegado' });

  } catch (err) {
    console.error('Error al listar proyectos:', err);
    res.status(500).json({ msg: 'Error al listar proyectos' });
  }
});

// =====================================================
// CREAR NUEVO PROYECTO (solo tutores)
// =====================================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;
    const { promocion_id, especialidad_id, titulo, descripcion } = req.body;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Solo tutores pueden crear proyectos' });
    }

    if (!promocion_id || !especialidad_id || !titulo) {
      return res.status(400).json({ msg: 'Faltan datos requeridos' });
    }

    // Verificar que la promoción existe
    const [[promocion]] = await db.query(
      'SELECT id FROM promociones WHERE id = ?',
      [promocion_id]
    );

    if (!promocion) {
      return res.status(404).json({ msg: 'Promoción no encontrada' });
    }

    // Verificar que la especialidad existe
    const [[especialidad]] = await db.query(
      'SELECT id FROM especialidades WHERE id = ?',
      [especialidad_id]
    );

    if (!especialidad) {
      return res.status(404).json({ msg: 'Especialidad no encontrada' });
    }

    const [result] = await db.query(`
      INSERT INTO proyectos (tutor_id, promocion_id, especialidad_id, titulo, descripcion)
      VALUES (?, ?, ?, ?, ?)
    `, [id, promocion_id, especialidad_id, titulo, descripcion || null]);

    res.json({ 
      id: result.insertId, 
      msg: 'Proyecto creado exitosamente' 
    });

  } catch (err) {
    console.error('Error al crear proyecto:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        msg: 'Ya existe un proyecto con ese título en esta promoción y especialidad' 
      });
    }
    res.status(500).json({ msg: 'Error al crear proyecto' });
  }
});

// =====================================================
// ACTUALIZAR PROYECTO
// =====================================================
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
      return res.status(403).json({ 
        msg: 'No tienes permiso para editar este proyecto' 
      });
    }

    await db.query(`
      UPDATE proyectos 
      SET titulo=?, descripcion=?, estado=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [titulo, descripcion || null, estado || 'pendiente', id]);

    res.json({ msg: 'Proyecto actualizado' });

  } catch (err) {
    console.error('Error al actualizar proyecto:', err);
    res.status(500).json({ msg: 'Error al actualizar proyecto' });
  }
});

// =====================================================
// ELIMINAR PROYECTO (soft delete)
// =====================================================
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
      return res.status(403).json({ 
        msg: 'No tienes permiso para eliminar este proyecto' 
      });
    }

    await db.query('UPDATE proyectos SET eliminado=1 WHERE id=?', [id]);
    
    res.json({ msg: 'Proyecto eliminado' });

  } catch (err) {
    console.error('Error al eliminar proyecto:', err);
    res.status(500).json({ msg: 'Error al eliminar proyecto' });
  }
});

// =====================================================
// OBTENER PROYECTO POR ID
// =====================================================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id: userId, rol } = req.user;
    const { id } = req.params;

    const [[proyecto]] = await db.query(`
      SELECT 
        p.*,
        pr.anio AS promocion,
        e.nombre AS especialidad,
        u.nombre AS tutor
      FROM proyectos p
      JOIN promociones pr ON pr.id = p.promocion_id
      JOIN especialidades e ON e.id = p.especialidad_id
      JOIN usuarios u ON u.id = p.tutor_id
      WHERE p.id = ? AND p.eliminado = 0
    `, [id]);

    if (!proyecto) {
      return res.status(404).json({ msg: 'Proyecto no encontrado' });
    }

    // Tutores pueden ver cualquier proyecto (sin restricción)
    res.json(proyecto);

  } catch (err) {
    console.error('Error al obtener proyecto:', err);
    res.status(500).json({ msg: 'Error al obtener proyecto' });
  }
});

// =====================================================
// OBTENER PROYECTOS POR PROMOCIÓN
// =====================================================
router.get('/promocion/:promocion_id', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    const { promocion_id } = req.params;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.titulo AS tema_proyecto,
        p.descripcion,
        p.estado,
        e.nombre AS especialidad,
        u.nombre AS tutor,
        af.nombre_archivo,
        af.nombre_visible
      FROM proyectos p
      JOIN especialidades e ON e.id = p.especialidad_id
      JOIN usuarios u ON u.id = p.tutor_id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      WHERE p.promocion_id = ? AND p.eliminado = 0
      ORDER BY e.nombre, p.titulo
    `, [promocion_id]);

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener proyectos por promoción:', err);
    res.status(500).json({ msg: 'Error al obtener proyectos' });
  }
});

// =====================================================
// OBTENER PROYECTOS POR ESPECIALIDAD
// =====================================================
router.get('/especialidad/:especialidad_id', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    const { especialidad_id } = req.params;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.titulo AS tema_proyecto,
        p.descripcion,
        p.estado,
        pr.anio AS promocion,
        u.nombre AS tutor,
        af.nombre_archivo,
        af.nombre_visible
      FROM proyectos p
      JOIN promociones pr ON pr.id = p.promocion_id
      JOIN usuarios u ON u.id = p.tutor_id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      WHERE p.especialidad_id = ? AND p.eliminado = 0
      ORDER BY pr.anio DESC, p.titulo
    `, [especialidad_id]);

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener proyectos por especialidad:', err);
    res.status(500).json({ msg: 'Error al obtener proyectos' });
  }
});

module.exports = router;