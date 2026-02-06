const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');



router.get('/', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;

    if (rol === 'admin' || rol === 'secretaria') {
      const [rows] = await db.query(`
        SELECT 
          c.id,
          CONCAT(c.nombre,' ',c.paralelo) AS nombre,
          pr.anio AS promocion,
          e.nombre AS especialidad
        FROM cursos c
        JOIN promociones pr ON pr.id = c.promocion_id
        JOIN especialidades e ON e.id = c.especialidad_id
        ORDER BY pr.anio DESC, e.nombre, c.nombre, c.paralelo
      `);
      return res.json(rows);
    }

    if (rol === 'tutor') {
      const [rows] = await db.query(`
        SELECT 
          c.id,
          CONCAT(c.nombre,' ',c.paralelo) AS nombre,
          pr.anio AS promocion,
          e.nombre AS especialidad
        FROM tutor_curso tc
        JOIN cursos c ON c.id = tc.curso_id
        JOIN promociones pr ON pr.id = c.promocion_id
        JOIN especialidades e ON e.id = c.especialidad_id
        WHERE tc.tutor_id=?
        ORDER BY pr.anio DESC, e.nombre, c.nombre, c.paralelo
      `, [id]);
      return res.json(rows);
    }

    // estudiante
    const [rows] = await db.query(`
      SELECT 
        c.id,
        CONCAT(c.nombre,' ',c.paralelo) AS nombre,
        pr.anio AS promocion,
        e.nombre AS especialidad
      FROM estudiante_curso ec
      JOIN cursos c ON c.id = ec.curso_id
      JOIN promociones pr ON pr.id = c.promocion_id
      JOIN especialidades e ON e.id = c.especialidad_id
      WHERE ec.estudiante_id=?
    `, [id]);

    return res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al listar cursos' });
  }
});

module.exports = router;
