const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;

    if (rol !== 'admin' && rol !== 'secretaria') {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    const [rows] = await db.query(`
      SELECT id, nombre, correo, rol, created_at
      FROM usuarios
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al listar usuarios' });
  }
});

module.exports = router;
