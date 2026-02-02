const router = require('express').Router();
const ctrl = require('../controllers/notas.controller');
const { verifyToken } = require('../middlewares/auth');



// Crear o actualizar nota (docente)
router.post('/', verifyToken, ctrl.guardarNota);

// Ver notas de un proyecto
router.get('/proyecto/:id', verifyToken, ctrl.verNotasProyecto);

module.exports = router;
