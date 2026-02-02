const PDFDocument = require('pdfkit');
const fs = require('fs');
const db = require('../config/database');

exports.generarReporteCurso = async (req,res)=>{
    const {curso_id} = req.params;

    const [rows] = await db.query(`
        SELECT u.nombre, p.titulo, n.calificacion
        FROM proyectos p
        JOIN usuarios u ON p.estudiante_id=u.id
        JOIN notas n ON n.proyecto_id=p.id
        WHERE p.curso_id=?`, [curso_id]);

    const doc = new PDFDocument();
    const path = `src/uploads/reporte_curso_${curso_id}.pdf`;
    doc.pipe(fs.createWriteStream(path));

    doc.fontSize(18).text('Reporte de Proyectos por Curso', {align:'center'});
    doc.moveDown();

    rows.forEach(r=>{
        doc.fontSize(12).text(
            `Estudiante: ${r.nombre}
Proyecto: ${r.titulo}
Nota: ${r.calificacion}
-----------------------------`
        );
    });

    doc.end();

    res.download(path);
};
