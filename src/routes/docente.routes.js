const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

// Cursos asignados
router.get('/cursos', verifyToken, async (req,res)=>{
  try{
    if(req.user.rol !== 'docente') return res.status(403).json({msg:'No autorizado'});

    const [rows] = await db.query(`
      SELECT 
        c.id,
        CONCAT(c.nombre,' ',c.paralelo) AS curso,
        pr.anio AS promocion,
        e.nombre AS especialidad
      FROM docente_curso dc
      JOIN cursos c ON c.id = dc.curso_id
      JOIN promociones pr ON pr.id = c.promocion_id
      JOIN especialidades e ON e.id = c.especialidad_id
      WHERE dc.docente_id=?
      ORDER BY pr.anio DESC, e.nombre, c.nombre, c.paralelo
    `, [req.user.id]);

    res.json(rows);
  }catch(err){
    console.error(err);
    res.status(500).json({msg:'Error al listar cursos del docente'});
  }
});

// Estudiantes del curso + proyecto + archivo final + nota
router.get('/curso/:cursoId', verifyToken, async (req,res)=>{
  try{
    if(req.user.rol !== 'docente') return res.status(403).json({msg:'No autorizado'});

    const { cursoId } = req.params;

    const [[ok]] = await db.query(
      'SELECT id FROM docente_curso WHERE docente_id=? AND curso_id=?',
      [req.user.id, cursoId]
    );
    if(!ok) return res.status(403).json({msg:'Curso no asignado'});

    const [rows] = await db.query(`
      SELECT
        u.id AS estudiante_id,
        u.nombre AS estudiante,
        p.id AS proyecto_id,
        p.titulo,
        p.estado,
        af.nombre_visible,
        af.nombre_archivo,
        n.calificacion,
        n.observaciones,
        n.updated_at AS nota_actualizada
      FROM estudiante_curso ec
      JOIN usuarios u ON u.id = ec.estudiante_id
      LEFT JOIN proyectos p ON p.estudiante_id=u.id AND p.curso_id=ec.curso_id AND p.eliminado=0
      LEFT JOIN archivo_final af ON af.proyecto_id=p.id AND af.eliminado=0
      LEFT JOIN notas n ON n.proyecto_id=p.id AND n.docente_id=?
      WHERE ec.curso_id=?
      ORDER BY u.nombre ASC
    `, [req.user.id, cursoId]);

    res.json(rows);
  }catch(err){
    console.error(err);
    res.status(500).json({msg:'Error al listar estudiantes del curso'});
  }
});

module.exports = router;
