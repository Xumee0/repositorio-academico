const router = require('express').Router();
const ctrl = require('../controllers/reportes.controller');

router.get('/curso/:curso_id', ctrl.generarReporteCurso);

module.exports = router;
