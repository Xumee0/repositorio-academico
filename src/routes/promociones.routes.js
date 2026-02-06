const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

// =====================================================
// LISTAR TODAS LAS PROMOCIONES
// =====================================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    
    if (rol !== 'admin') {
      return res.status(403).json({ msg: 'Solo administradores pueden gestionar promociones' });
    }

    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.anio,
        p.descripcion,
        p.created_at,
        COUNT(DISTINCT pr.id) AS total_proyectos
      FROM promociones p
      LEFT JOIN proyectos pr ON pr.promocion_id = p.id AND pr.eliminado = 0
      GROUP BY p.id
      ORDER BY p.anio DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error('Error al listar promociones:', err);
    res.status(500).json({ msg: 'Error al listar promociones' });
  }
});

// =====================================================
// OBTENER UNA PROMOCIÓN POR ID
// =====================================================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    const { id } = req.params;
    
    if (rol !== 'admin') {
      return res.status(403).json({ msg: 'Solo administradores pueden gestionar promociones' });
    }

    const [[row]] = await db.query(`
      SELECT 
        p.id,
        p.anio,
        p.descripcion,
        p.created_at,
        COUNT(DISTINCT pr.id) AS total_proyectos
      FROM promociones p
      LEFT JOIN proyectos pr ON pr.promocion_id = p.id AND pr.eliminado = 0
      WHERE p.id = ?
      GROUP BY p.id
    `, [id]);

    if (!row) {
      return res.status(404).json({ msg: 'Promoción no encontrada' });
    }

    res.json(row);

  } catch (err) {
    console.error('Error al obtener promoción:', err);
    res.status(500).json({ msg: 'Error al obtener promoción' });
  }
});

// =====================================================
// CREAR NUEVA PROMOCIÓN
// =====================================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    const { anio, descripcion } = req.body;
    
    if (rol !== 'admin') {
      return res.status(403).json({ msg: 'Solo administradores pueden crear promociones' });
    }

    // Validaciones
    if (!anio) {
      return res.status(400).json({ msg: 'El año es obligatorio' });
    }

    const anioNum = parseInt(anio);
    if (isNaN(anioNum) || anioNum < 2000 || anioNum > 2100) {
      return res.status(400).json({ msg: 'El año debe ser un número válido entre 2000 y 2100' });
    }

    // Verificar si ya existe una promoción con ese año
    const [[existe]] = await db.query(
      'SELECT id FROM promociones WHERE anio = ?',
      [anioNum]
    );

    if (existe) {
      return res.status(400).json({ msg: `Ya existe una promoción para el año ${anioNum}` });
    }

    // Insertar nueva promoción
    const [result] = await db.query(
      'INSERT INTO promociones (anio, descripcion) VALUES (?, ?)',
      [anioNum, descripcion || null]
    );

    res.status(201).json({
      msg: 'Promoción creada exitosamente',
      promocion_id: result.insertId,
      anio: anioNum,
      descripcion: descripcion || null
    });

  } catch (err) {
    console.error('Error al crear promoción:', err);
    res.status(500).json({ msg: 'Error al crear promoción' });
  }
});

// =====================================================
// ACTUALIZAR PROMOCIÓN EXISTENTE
// =====================================================
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    const { id } = req.params;
    const { anio, descripcion } = req.body;
    
    if (rol !== 'admin') {
      return res.status(403).json({ msg: 'Solo administradores pueden modificar promociones' });
    }

    // Verificar que la promoción existe
    const [[existe]] = await db.query(
      'SELECT id FROM promociones WHERE id = ?',
      [id]
    );

    if (!existe) {
      return res.status(404).json({ msg: 'Promoción no encontrada' });
    }

    // Validaciones
    if (!anio) {
      return res.status(400).json({ msg: 'El año es obligatorio' });
    }

    const anioNum = parseInt(anio);
    if (isNaN(anioNum) || anioNum < 2000 || anioNum > 2100) {
      return res.status(400).json({ msg: 'El año debe ser un número válido entre 2000 y 2100' });
    }

    // Verificar si ya existe otra promoción con ese año
    const [[duplicado]] = await db.query(
      'SELECT id FROM promociones WHERE anio = ? AND id != ?',
      [anioNum, id]
    );

    if (duplicado) {
      return res.status(400).json({ msg: `Ya existe otra promoción para el año ${anioNum}` });
    }

    // Actualizar promoción
    await db.query(
      'UPDATE promociones SET anio = ?, descripcion = ? WHERE id = ?',
      [anioNum, descripcion || null, id]
    );

    res.json({
      msg: 'Promoción actualizada exitosamente',
      promocion_id: parseInt(id),
      anio: anioNum,
      descripcion: descripcion || null
    });

  } catch (err) {
    console.error('Error al actualizar promoción:', err);
    res.status(500).json({ msg: 'Error al actualizar promoción' });
  }
});

// =====================================================
// ELIMINAR PROMOCIÓN (solo si no tiene proyectos)
// =====================================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;
    const { id } = req.params;
    
    if (rol !== 'admin') {
      return res.status(403).json({ msg: 'Solo administradores pueden eliminar promociones' });
    }

    // Verificar que la promoción existe
    const [[promocion]] = await db.query(
      'SELECT id, anio FROM promociones WHERE id = ?',
      [id]
    );

    if (!promocion) {
      return res.status(404).json({ msg: 'Promoción no encontrada' });
    }

    // Verificar si tiene proyectos asociados
    const [[proyectos]] = await db.query(
      'SELECT COUNT(*) as total FROM proyectos WHERE promocion_id = ? AND eliminado = 0',
      [id]
    );

    if (proyectos.total > 0) {
      return res.status(400).json({ 
        msg: `No se puede eliminar la promoción ${promocion.anio} porque tiene ${proyectos.total} proyecto(s) asociado(s)` 
      });
    }

    // Eliminar promoción
    await db.query('DELETE FROM promociones WHERE id = ?', [id]);

    res.json({
      msg: `Promoción ${promocion.anio} eliminada exitosamente`
    });

  } catch (err) {
    console.error('Error al eliminar promoción:', err);
    res.status(500).json({ msg: 'Error al eliminar promoción' });
  }
});

module.exports = router;
