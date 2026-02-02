const router = require('express').Router();
const ctrl = require('../controllers/archivoFinal.controller');
const { verifyToken } = require('../middlewares/auth');

router.get('/', verifyToken, ctrl.listar);
router.post('/', verifyToken, ctrl.upload, ctrl.subirOReemplazar);
router.patch('/:proyecto_id/nombre', verifyToken, ctrl.renombrar);
router.delete('/:proyecto_id', verifyToken, ctrl.eliminar);

module.exports = router;
