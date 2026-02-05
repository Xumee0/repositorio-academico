// Actualizar validación de roles
// Cambiar 'docente' por 'tutor' en todas las validaciones
const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);

module.exports = router;
