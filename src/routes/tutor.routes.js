const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

// =====================================================
// OBTENER CURSOS DEL TUTOR
// =====================================================
router.get('/cursos', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;
    
    // Solo tutores y admins pueden acceder
    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    let query, params;

    if (rol === 'admin') {
      // Admin ve todos los cursos
      query = `
        SELECT 
          c.id,
          CONCAT(c.nombre, ' ', c.paralelo) AS curso,
          e.id AS especialidad_id,
          e.nombre AS especialidad,
          p.id AS promocion_id,
          p.anio AS promocion
        FROM cursos c
        JOIN especialidades e ON e.id = c.especialidad_id
        JOIN promociones p ON p.id = c.promocion_id
        ORDER BY p.anio DESC, e.nombre, c.nombre
      `;
      params = [];
    } else {
      // Tutor solo ve sus cursos asignados
      query = `
        SELECT 
          c.id,
          CONCAT(c.nombre, ' ', c.paralelo) AS curso,
          e.id AS especialidad_id,
          e.nombre AS especialidad,
          p.id AS promocion_id,
          p.anio AS promocion
        FROM tutor_curso tc
        JOIN cursos c ON c.id = tc.curso_id
        JOIN especialidades e ON e.id = c.especialidad_id
        JOIN promociones p ON p.id = c.promocion_id
        WHERE tc.tutor_id = ?
        ORDER BY p.anio DESC, e.nombre, c.nombre
      `;
      params = [id];
    }

    const [rows] = await db.query(query, params);
    res.json(rows);

  } catch (err) {
    console.error('Error al obtener cursos:', err);
    res.status(500).json({ msg: 'Error al obtener cursos' });
  }
});

// =====================================================
// OBTENER PROYECTOS DE UN CURSO ESPECÍFICO
// =====================================================
router.get('/curso/:curso_id', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;
    const { curso_id } = req.params;

    // Verificar que el tutor tiene acceso a este curso
    if (rol === 'tutor') {
      const [[acceso]] = await db.query(
        'SELECT 1 FROM tutor_curso WHERE tutor_id=? AND curso_id=?',
        [id, curso_id]
      );
      
      if (!acceso) {
        return res.status(403).json({ msg: 'No tienes acceso a este curso' });
      }
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
        u.nombre AS tutor_proyecto
      FROM proyectos p
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      LEFT JOIN notas n ON n.proyecto_id = p.id AND n.tutor_id = ?
      LEFT JOIN usuarios u ON u.id = p.tutor_id
      WHERE p.curso_id = ? AND p.eliminado = 0
      ORDER BY p.titulo
    `, [id, curso_id]);

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener proyectos del curso:', err);
    res.status(500).json({ msg: 'Error al obtener proyectos' });
  }
});

// =====================================================
// OBTENER ESTADÍSTICAS DEL TUTOR
// =====================================================
router.get('/estadisticas', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;

    if (rol !== 'tutor' && rol !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }

    let whereClause = rol === 'tutor' ? 'WHERE tc.tutor_id = ?' : '';
    let params = rol === 'tutor' ? [id] : [];

    const [stats] = await db.query(`
      SELECT 
        COUNT(DISTINCT c.id) AS total_cursos,
        COUNT(DISTINCT p.id) AS total_proyectos,
        COUNT(DISTINCT af.id) AS proyectos_con_archivo,
        COUNT(DISTINCT n.id) AS proyectos_calificados
      FROM tutor_curso tc
      JOIN cursos c ON c.id = tc.curso_id
      LEFT JOIN proyectos p ON p.curso_id = c.id AND p.eliminado = 0
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      LEFT JOIN notas n ON n.proyecto_id = p.id
      ${whereClause}
    `, params);

    res.json(stats[0] || {
      total_cursos: 0,
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
// OBTENER INFORMACIÓN DETALLADA DE UN CURSO
// =====================================================
router.get('/curso/:curso_id/info', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;
    const { curso_id } = req.params;

    // Verificar acceso
    if (rol === 'tutor') {
      const [[acceso]] = await db.query(
        'SELECT 1 FROM tutor_curso WHERE tutor_id=? AND curso_id=?',
        [id, curso_id]
      );
      if (!acceso) {
        return res.status(403).json({ msg: 'No tienes acceso a este curso' });
      }
    }

    // Información del curso
    const [[curso]] = await db.query(`
      SELECT 
        c.id,
        c.nombre,
        c.paralelo,
        e.nombre AS especialidad,
        p.anio AS promocion,
        COUNT(DISTINCT pr.id) AS total_proyectos,
        COUNT(DISTINCT af.id) AS proyectos_con_archivo
      FROM cursos c
      JOIN especialidades e ON e.id = c.especialidad_id
      JOIN promociones p ON p.id = c.promocion_id
      LEFT JOIN proyectos pr ON pr.curso_id = c.id AND pr.eliminado = 0
      LEFT JOIN archivo_final af ON af.proyecto_id = pr.id AND af.eliminado = 0
      WHERE c.id = ?
      GROUP BY c.id
    `, [curso_id]);

    if (!curso) {
      return res.status(404).json({ msg: 'Curso no encontrado' });
    }

    // Tutores del curso
    const [tutores] = await db.query(`
      SELECT u.id, u.nombre, u.correo
      FROM tutor_curso tc
      JOIN usuarios u ON u.id = tc.tutor_id
      WHERE tc.curso_id = ?
    `, [curso_id]);

    res.json({
      ...curso,
      tutores
    });

  } catch (err) {
    console.error('Error al obtener información del curso:', err);
    res.status(500).json({ msg: 'Error al obtener información' });
  }
});

module.exports = router;