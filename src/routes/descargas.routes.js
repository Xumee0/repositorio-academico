const router = require('express').Router();
const db = require('../config/database');
const { verifyToken } = require('../middlewares/auth');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// =====================================================
// DESCARGAR TODOS LOS PDFs DE UNA ESPECIALIDAD Y PROMOCIÓN (ZIP)
// =====================================================
router.get('/pdfs/:especialidad_id/:promocion_id', verifyToken, async (req, res) => {
  try {
    const { especialidad_id, promocion_id } = req.params;

    // Obtener información de especialidad y promoción
    const [[info]] = await db.query(`
      SELECT 
        e.nombre AS especialidad,
        pr.anio AS promocion
      FROM especialidades e, promociones pr
      WHERE e.id = ? AND pr.id = ?
    `, [especialidad_id, promocion_id]);

    if (!info) {
      return res.status(404).json({ msg: 'Especialidad o promoción no encontrada' });
    }

    // Obtener archivos
    const [archivos] = await db.query(`
      SELECT 
        af.nombre_archivo,
        af.nombre_visible,
        p.titulo AS proyecto,
        u.nombre AS tutor
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      JOIN usuarios u ON u.id = p.tutor_id
      WHERE af.eliminado = 0 
        AND p.eliminado = 0
        AND p.especialidad_id = ?
        AND p.promocion_id = ?
      ORDER BY p.titulo
    `, [especialidad_id, promocion_id]);

    if (archivos.length === 0) {
      return res.status(404).json({ 
        msg: 'No hay memorias técnicas disponibles para esta especialidad y promoción' 
      });
    }

    // Crear ZIP
    const archive = archiver('zip', { 
      zlib: { level: 9 }
    });

    const nombreZip = `Memorias_Tecnicas_${info.especialidad.replace(/\s/g, '_')}_${info.promocion}.zip`;
    res.attachment(nombreZip);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreZip}"`);

    archive.pipe(res);

    const uploadsPath = path.join(__dirname, '../uploads');
    let archivosAgregados = 0;

    archivos.forEach((archivo, index) => {
      const filePath = path.join(uploadsPath, archivo.nombre_archivo);
      
      if (fs.existsSync(filePath)) {
        const extension = path.extname(archivo.nombre_archivo);
        const nombreEnZip = `${String(index + 1).padStart(3, '0')}_${archivo.proyecto}${extension}`;
        
        archive.file(filePath, { name: nombreEnZip });
        archivosAgregados++;
      }
    });

    const readmeContent = `
MEMORIAS TÉCNICAS
=================

Especialidad: ${info.especialidad}
Promoción: ${info.promocion}
Fecha de descarga: ${new Date().toLocaleString('es-EC')}
Total de archivos: ${archivosAgregados}

---
Generado por Sistema de Repositorio Académico
    `.trim();

    archive.append(readmeContent, { name: 'README.txt' });
    await archive.finalize();

  } catch (err) {
    console.error('Error al generar ZIP:', err);
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Error al generar descarga' });
    }
  }
});

// =====================================================
// DESCARGAR EXCEL GENERAL CON HOJAS POR PROMOCIÓN Y ESPECIALIDAD
// =====================================================
router.get('/excel', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;

    if (rol !== 'admin') {
      return res.status(403).json({ 
        msg: 'Solo administradores pueden descargar el Excel general' 
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Repositorio Académico';
    workbook.created = new Date();

    // HOJA: RESUMEN GENERAL
    const resumenSheet = workbook.addWorksheet('📊 Resumen');
    
    const [[stats]] = await db.query(`
      SELECT 
        COUNT(DISTINCT pr.id) AS total_promociones,
        COUNT(DISTINCT e.id) AS total_especialidades,
        COUNT(DISTINCT p.id) AS total_proyectos,
        COUNT(DISTINCT CASE WHEN af.id IS NOT NULL THEN p.id END) AS proyectos_con_memoria,
        COUNT(DISTINCT CASE WHEN n.id IS NOT NULL THEN p.id END) AS proyectos_calificados,
        COALESCE(AVG(n.calificacion), 0) AS calificacion_promedio
      FROM proyectos p
      JOIN promociones pr ON pr.id = p.promocion_id
      JOIN especialidades e ON e.id = p.especialidad_id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      LEFT JOIN notas n ON n.proyecto_id = p.id
      WHERE p.eliminado = 0
    `);

    resumenSheet.addRow(['RESUMEN GENERAL']);
    resumenSheet.addRow(['']);
    resumenSheet.addRow(['Concepto', 'Valor']);
    resumenSheet.addRow(['Promociones', stats.total_promociones]);
    resumenSheet.addRow(['Especialidades', stats.total_especialidades]);
    resumenSheet.addRow(['Proyectos', stats.total_proyectos]);
    resumenSheet.addRow(['Con Memoria', stats.proyectos_con_memoria]);
    resumenSheet.addRow(['Calificados', stats.proyectos_calificados]);
    resumenSheet.addRow(['Promedio', Number(stats.calificacion_promedio).toFixed(2)]);
    resumenSheet.addRow(['']);
    resumenSheet.addRow(['Generado:', new Date().toLocaleString('es-EC')]);

    resumenSheet.getColumn(1).width = 30;
    resumenSheet.getColumn(2).width = 20;
    resumenSheet.getRow(1).font = { bold: true, size: 14 };
    resumenSheet.getRow(3).font = { bold: true };
    resumenSheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    // OBTENER COMBINACIONES PROMOCIÓN-ESPECIALIDAD
    const [combinaciones] = await db.query(`
      SELECT DISTINCT
        pr.id AS promocion_id,
        pr.anio AS promocion,
        pr.descripcion,
        e.id AS especialidad_id,
        e.nombre AS especialidad
      FROM promociones pr
      CROSS JOIN especialidades e
      WHERE EXISTS (
        SELECT 1 FROM proyectos p 
        WHERE p.promocion_id = pr.id 
          AND p.especialidad_id = e.id 
          AND p.eliminado = 0
      )
      ORDER BY pr.anio DESC, e.nombre
    `);

    // CREAR HOJA POR CADA COMBINACIÓN
    for (const combo of combinaciones) {
      const [proyectos] = await db.query(`
        SELECT 
          p.titulo AS Proyecto,
          p.descripcion AS Descripcion,
          p.estado AS Estado,
          u.nombre AS Tutor,
          COALESCE(AVG(n.calificacion), 0) AS Calificacion,
          COUNT(DISTINCT n.id) AS Notas,
          IF(af.id IS NOT NULL, 'Sí', 'No') AS Memoria,
          af.nombre_visible AS Archivo,
          DATE_FORMAT(p.created_at, '%d/%m/%Y') AS Fecha
        FROM proyectos p
        JOIN usuarios u ON u.id = p.tutor_id
        LEFT JOIN notas n ON n.proyecto_id = p.id
        LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
        WHERE p.eliminado = 0
          AND p.promocion_id = ?
          AND p.especialidad_id = ?
        GROUP BY p.id
        ORDER BY p.titulo
      `, [combo.promocion_id, combo.especialidad_id]);

      if (proyectos.length === 0) continue;

      let nombreHoja = `${combo.promocion} ${combo.especialidad}`;
      if (nombreHoja.length > 31) {
        nombreHoja = nombreHoja.substring(0, 28) + '...';
      }

      const ws = workbook.addWorksheet(nombreHoja);

      // Título
      ws.mergeCells('A1:I1');
      ws.getCell('A1').value = `${combo.especialidad} - Promoción ${combo.promocion}`;
      ws.getCell('A1').font = { bold: true, size: 14 };
      ws.getCell('A1').alignment = { horizontal: 'center' };
      ws.getRow(1).height = 25;

      if (combo.descripcion) {
        ws.mergeCells('A2:I2');
        ws.getCell('A2').value = combo.descripcion;
        ws.getCell('A2').font = { italic: true, size: 10 };
        ws.getCell('A2').alignment = { horizontal: 'center' };
      }

      ws.addRow([]);

      // Encabezados
      const headerRow = ws.addRow(['Proyecto', 'Descripción', 'Estado', 'Tutor', 'Calif.', 'Notas', 'Memoria', 'Archivo', 'Fecha']);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
      headerRow.alignment = { horizontal: 'center' };
      headerRow.height = 20;

      ws.getColumn(1).width = 40;
      ws.getColumn(2).width = 50;
      ws.getColumn(3).width = 12;
      ws.getColumn(4).width = 25;
      ws.getColumn(5).width = 10;
      ws.getColumn(6).width = 8;
      ws.getColumn(7).width = 10;
      ws.getColumn(8).width = 25;
      ws.getColumn(9).width = 12;

      // Datos
      proyectos.forEach((p, i) => {
        const row = ws.addRow([
          p.Proyecto,
          p.Descripcion || '',
          p.Estado,
          p.Tutor,
          Number(p.Calificacion).toFixed(2),
          p.Notas,
          p.Memoria,
          p.Archivo || '',
          p.Fecha
        ]);

        if (i % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        }

        row.getCell(1).alignment = { wrapText: true };
        row.getCell(2).alignment = { wrapText: true };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'center' };

        // Colores
        const estadoCell = row.getCell(3);
        estadoCell.alignment = { horizontal: 'center' };
        if (p.Estado === 'aprobado') estadoCell.font = { color: { argb: 'FF28A745' }, bold: true };
        else if (p.Estado === 'rechazado') estadoCell.font = { color: { argb: 'FFDC3545' }, bold: true };
        else if (p.Estado === 'finalizado') estadoCell.font = { color: { argb: 'FF007BFF' }, bold: true };

        if (p.Memoria === 'Sí') row.getCell(7).font = { color: { argb: 'FF28A745' }, bold: true };
        else row.getCell(7).font = { color: { argb: 'FFDC3545' } };

        const calif = Number(p.Calificacion);
        if (calif >= 9) row.getCell(5).font = { color: { argb: 'FF28A745' }, bold: true };
        else if (calif >= 7) row.getCell(5).font = { color: { argb: 'FF007BFF' } };
        else if (calif > 0) row.getCell(5).font = { color: { argb: 'FFDC3545' } };
      });

      // Totales
      ws.addRow([]);
      const totalRow = ws.addRow([
        'TOTALES:',
        proyectos.length + ' proyectos',
        '',
        '',
        (proyectos.reduce((s, p) => s + Number(p.Calificacion), 0) / proyectos.length).toFixed(2),
        '',
        proyectos.filter(p => p.Memoria === 'Sí').length
      ]);
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

      ws.views = [{ state: 'frozen', ySplit: combo.descripcion ? 4 : 3 }];
    }

    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Reporte_Proyectos_${fechaHoy}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`Excel generado: ${nombreArchivo}`);

  } catch (err) {
    console.error('Error al generar Excel:', err);
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Error al generar Excel' });
    }
  }
});

module.exports = router;