const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

// =====================================================
// OBTENER TODAS LAS PROMOCIONES
// =====================================================
router.get('/promociones', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    
    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    const [rows] = await db.query(`
      SELECT 
        id,
        anio,
        descripcion
      FROM promociones
      ORDER BY anio DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener promociones:', err);
    res.status(500).json({ msg: 'Error al obtener promociones' });
  }
});

// =====================================================
// OBTENER ESPECIALIDADES
// =====================================================
router.get('/especialidades', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    
    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    const [rows] = await db.query(`
      SELECT 
        id,
        nombre
      FROM especialidades
      ORDER BY nombre
    `);

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener especialidades:', err);
    res.status(500).json({ msg: 'Error al obtener especialidades' });
  }
});

// =====================================================
// OBTENER PROYECTOS POR PROMOCIÓN Y ESPECIALIDAD
// =====================================================
router.get('/proyectos/:promocion_id/:especialidad_id', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;
    const { promocion_id, especialidad_id } = req.params;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    // Obtener proyectos con archivos y notas
    const [rows] = await db.query(`
      SELECT 
        p.id AS proyecto_id,
        p.titulo AS tema_proyecto,
        p.descripcion,
        p.estado,
        p.created_at,
        p.updated_at,
        af.id AS archivo_id,
        af.nombre_visible,
        af.nombre_archivo,
        af.mime_type,
        af.tamano_bytes,
        n.calificacion,
        n.observaciones,
        u.nombre AS tutor_proyecto,
        pr.anio AS promocion,
        e.nombre AS especialidad
      FROM proyectos p
      JOIN promociones pr ON pr.id = p.promocion_id
      JOIN especialidades e ON e.id = p.especialidad_id
      JOIN usuarios u ON u.id = p.tutor_id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      LEFT JOIN notas n ON n.proyecto_id = p.id AND n.tutor_id = ?
      WHERE p.promocion_id = ? 
        AND p.especialidad_id = ? 
        AND p.eliminado = 0
      ORDER BY p.titulo
    `, [id, promocion_id, especialidad_id]);

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener proyectos:', err);
    res.status(500).json({ msg: 'Error al obtener proyectos' });
  }
});

// =====================================================
// OBTENER ESTADÍSTICAS GENERALES
// =====================================================
router.get('/estadisticas', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    const [stats] = await db.query(`
      SELECT 
        COUNT(DISTINCT pr.id) AS total_promociones,
        COUNT(DISTINCT e.id) AS total_especialidades,
        COUNT(DISTINCT p.id) AS total_proyectos,
        COUNT(DISTINCT af.id) AS proyectos_con_archivo,
        COUNT(DISTINCT n.id) AS proyectos_calificados
      FROM proyectos p
      JOIN promociones pr ON pr.id = p.promocion_id
      JOIN especialidades e ON e.id = p.especialidad_id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      LEFT JOIN notas n ON n.proyecto_id = p.id
      WHERE p.eliminado = 0
    `);

    res.json(stats[0] || {
      total_promociones: 0,
      total_especialidades: 0,
      total_proyectos: 0,
      proyectos_con_archivo: 0,
      proyectos_calificados: 0
    });

  } catch (err) {
    console.error('Error al obtener estadísticas:', err);
    res.status(500).json({ msg: 'Error al obtener estadísticas' });
  }
});

// =====================================================
// OBTENER RESUMEN POR PROMOCIÓN Y ESPECIALIDAD
// =====================================================
router.get('/resumen/:promocion_id/:especialidad_id', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    const { promocion_id, especialidad_id } = req.params;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    const [[resumen]] = await db.query(`
      SELECT 
        pr.anio AS promocion,
        pr.descripcion AS promocion_descripcion,
        e.nombre AS especialidad,
        COUNT(DISTINCT p.id) AS total_proyectos,
        COUNT(DISTINCT af.id) AS proyectos_con_memoria,
        COUNT(DISTINCT n.id) AS proyectos_calificados,
        COALESCE(AVG(n.calificacion), 0) AS promedio_calificaciones
      FROM promociones pr
      JOIN especialidades e ON e.id = ?
      LEFT JOIN proyectos p ON p.promocion_id = pr.id 
        AND p.especialidad_id = e.id 
        AND p.eliminado = 0
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      LEFT JOIN notas n ON n.proyecto_id = p.id
      WHERE pr.id = ?
      GROUP BY pr.id, e.id
    `, [especialidad_id, promocion_id]);

    if (!resumen) {
      return res.status(404).json({ msg: 'No se encontró información' });
    }

    res.json(resumen);

  } catch (err) {
    console.error('Error al obtener resumen:', err);
    res.status(500).json({ msg: 'Error al obtener resumen' });
  }
});

// =====================================================
// OBTENER COMBINACIONES PROMOCIÓN-ESPECIALIDAD CON PROYECTOS
// =====================================================
router.get('/combinaciones', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    const [rows] = await db.query(`
      SELECT DISTINCT
        pr.id AS promocion_id,
        pr.anio AS promocion,
        e.id AS especialidad_id,
        e.nombre AS especialidad,
        COUNT(p.id) AS total_proyectos
      FROM promociones pr
      CROSS JOIN especialidades e
      LEFT JOIN proyectos p ON p.promocion_id = pr.id 
        AND p.especialidad_id = e.id 
        AND p.eliminado = 0
      GROUP BY pr.id, e.id
      ORDER BY pr.anio DESC, e.nombre
    `);

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener combinaciones:', err);
    res.status(500).json({ msg: 'Error al obtener combinaciones' });
  }
});

module.exports = router;