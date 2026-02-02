const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');



router.get('/', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;

// Admin/Secretaría: todos los proyectos
if (rol === 'admin' || rol === 'secretaria') {
  const [rows] = await db.query(`
    SELECT 
      p.id, p.titulo, p.descripcion, p.estado, p.created_at,
      u.nombre AS estudiante,
      CONCAT(c.nombre,' ',c.paralelo,' - ',e.nombre,' - ',pr.anio) AS curso,
      COALESCE(GROUP_CONCAT(du.nombre SEPARATOR ', '), '-') AS tutor
    FROM proyectos p
    JOIN usuarios u ON u.id = p.estudiante_id
    JOIN cursos c ON c.id = p.curso_id
    JOIN especialidades e ON e.id = c.especialidad_id
    JOIN promociones pr ON pr.id = c.promocion_id
    LEFT JOIN docente_curso dc ON dc.curso_id = p.curso_id
    LEFT JOIN usuarios du ON du.id = dc.docente_id
    WHERE p.eliminado=0
    GROUP BY p.id
    ORDER BY p.id DESC
  `);

  return res.json(rows);
}


    // Docente: proyectos de cursos asignados
    if (rol === 'docente') {
      const [rows] = await db.query(`
        SELECT 
          p.id, p.titulo, p.descripcion, p.estado, p.created_at,
          u.nombre AS estudiante,
          CONCAT(c.nombre,' ',c.paralelo,' - ',e.nombre,' - ',pr.anio) AS curso
        FROM proyectos p
        JOIN usuarios u ON u.id = p.estudiante_id
        JOIN cursos c ON c.id = p.curso_id
        JOIN docente_curso dc ON dc.curso_id = p.curso_id
        JOIN especialidades e ON e.id = c.especialidad_id
        JOIN promociones pr ON pr.id = c.promocion_id
        WHERE dc.docente_id=? AND p.eliminado=0
        ORDER BY p.id DESC
      `, [id]);
      return res.json(rows);
    }

    // Estudiante: su proyecto (por su curso)
    const [[ec]] = await db.query(
      `SELECT curso_id FROM estudiante_curso WHERE estudiante_id=?`,
      [id]
    );

    if (!ec) return res.json([]);

    const [rows] = await db.query(`
      SELECT 
        p.id, p.titulo, p.descripcion, p.estado, p.created_at,
        CONCAT(c.nombre,' ',c.paralelo,' - ',e.nombre,' - ',pr.anio) AS curso
      FROM proyectos p
      JOIN cursos c ON c.id = p.curso_id
      JOIN especialidades e ON e.id = c.especialidad_id
      JOIN promociones pr ON pr.id = c.promocion_id
      WHERE p.estudiante_id=? AND p.curso_id=? AND p.eliminado=0
      ORDER BY p.id DESC
    `, [id, ec.curso_id]);

    return res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al listar proyectos' });
  }
});

module.exports = router;
