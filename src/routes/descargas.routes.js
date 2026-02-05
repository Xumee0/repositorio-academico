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
    const { id, rol } = req.user;
    const { especialidad_id, promocion_id } = req.params;

    // Verificar permisos
    if (rol === 'tutor') {
      // Tutor solo puede descargar de sus cursos
      const [[acceso]] = await db.query(`
        SELECT 1 FROM tutor_curso tc
        JOIN cursos c ON c.id = tc.curso_id
        WHERE tc.tutor_id = ? 
          AND c.especialidad_id = ? 
          AND c.promocion_id = ?
        LIMIT 1
      `, [id, especialidad_id, promocion_id]);

      if (!acceso) {
        return res.status(403).json({ msg: 'No tienes acceso a estos proyectos' });
      }
    }

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
        CONCAT(c.nombre, ' ', c.paralelo) AS curso,
        u.nombre AS tutor
      FROM archivo_final af
      JOIN proyectos p ON p.id = af.proyecto_id
      JOIN cursos c ON c.id = p.curso_id
      JOIN usuarios u ON u.id = p.tutor_id
      WHERE af.eliminado = 0 
        AND p.eliminado = 0
        AND c.especialidad_id = ?
        AND c.promocion_id = ?
      ORDER BY c.nombre, p.titulo
    `, [especialidad_id, promocion_id]);

    if (archivos.length === 0) {
      return res.status(404).json({ 
        msg: 'No hay memorias técnicas disponibles para esta especialidad y promoción' 
      });
    }

    // Crear ZIP
    const archive = archiver('zip', { 
      zlib: { level: 9 } // Máxima compresión
    });

    const nombreZip = `Memorias_Tecnicas_${info.especialidad.replace(/\s/g, '_')}_${info.promocion}.zip`;
    res.attachment(nombreZip);
    
    // Configurar headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreZip}"`);

    // Pipe del archive a la respuesta
    archive.pipe(res);

    const uploadsPath = path.join(__dirname, '../uploads');
    let archivosAgregados = 0;

    // Agregar archivos al ZIP
    archivos.forEach((archivo, index) => {
      const filePath = path.join(uploadsPath, archivo.nombre_archivo);
      
      if (fs.existsSync(filePath)) {
        // Crear nombre descriptivo para el archivo en el ZIP
        const extension = path.extname(archivo.nombre_archivo);
        const nombreEnZip = `${archivo.curso}/${archivo.proyecto}${extension}`;
        
        archive.file(filePath, { name: nombreEnZip });
        archivosAgregados++;
      } else {
        console.warn(`Archivo no encontrado: ${archivo.nombre_archivo}`);
      }
    });

    // Agregar un archivo README con información
    const readmeContent = `
MEMORIAS TÉCNICAS
=================

Especialidad: ${info.especialidad}
Promoción: ${info.promocion}
Fecha de descarga: ${new Date().toLocaleString('es-EC')}
Total de archivos: ${archivosAgregados}

Este archivo ZIP contiene las memorias técnicas de los proyectos de grado.
Los archivos están organizados por curso.

---
Generado por Sistema de Repositorio Académico
    `.trim();

    archive.append(readmeContent, { name: 'README.txt' });

    // Finalizar el archivo
    await archive.finalize();

    console.log(`ZIP creado: ${nombreZip} - ${archivosAgregados} archivos`);

  } catch (err) {
    console.error('Error al generar ZIP:', err);
    
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Error al generar descarga' });
    }
  }
});

// =====================================================
// DESCARGAR EXCEL GENERAL (SOLO ADMIN)
// =====================================================
router.get('/excel', verifyToken, async (req, res) => {
  try {
    const { rol } = req.user;

    // Solo administradores
    if (rol !== 'admin') {
      return res.status(403).json({ 
        msg: 'Solo administradores pueden descargar el Excel general' 
      });
    }

    // Obtener datos completos
    const [datos] = await db.query(`
      SELECT 
        pr.anio AS Promocion,
        e.nombre AS Especialidad,
        CONCAT(c.nombre, ' ', c.paralelo) AS Curso,
        p.titulo AS Proyecto,
        p.descripcion AS Descripcion,
        p.estado AS Estado,
        u.nombre AS Tutor,
        COALESCE(AVG(n.calificacion), 0) AS Calificacion_Promedio,
        COUNT(DISTINCT n.id) AS Numero_Calificaciones,
        IF(af.id IS NOT NULL, 'Sí', 'No') AS Memoria_Tecnica,
        af.nombre_visible AS Nombre_Archivo,
        p.created_at AS Fecha_Creacion,
        p.updated_at AS Fecha_Actualizacion
      FROM proyectos p
      JOIN cursos c ON c.id = p.curso_id
      JOIN especialidades e ON e.id = c.especialidad_id
      JOIN promociones pr ON pr.id = c.promocion_id
      JOIN usuarios u ON u.id = p.tutor_id
      LEFT JOIN notas n ON n.proyecto_id = p.id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      WHERE p.eliminado = 0
      GROUP BY p.id
      ORDER BY pr.anio DESC, e.nombre, c.nombre, p.titulo
    `);

    // Crear libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Repositorio Académico';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Hoja principal
    const worksheet = workbook.addWorksheet('Proyectos Completo');

    // Definir columnas
    worksheet.columns = [
      { header: 'Promoción', key: 'Promocion', width: 12 },
      { header: 'Especialidad', key: 'Especialidad', width: 20 },
      { header: 'Curso', key: 'Curso', width: 15 },
      { header: 'Proyecto', key: 'Proyecto', width: 40 },
      { header: 'Descripción', key: 'Descripcion', width: 50 },
      { header: 'Estado', key: 'Estado', width: 15 },
      { header: 'Tutor', key: 'Tutor', width: 30 },
      { header: 'Calificación Promedio', key: 'Calificacion_Promedio', width: 20 },
      { header: 'N° Calificaciones', key: 'Numero_Calificaciones', width: 18 },
      { header: 'Memoria Técnica', key: 'Memoria_Tecnica', width: 18 },
      { header: 'Nombre Archivo', key: 'Nombre_Archivo', width: 40 },
      { header: 'Fecha Creación', key: 'Fecha_Creacion', width: 20 },
      { header: 'Última Actualización', key: 'Fecha_Actualizacion', width: 20 }
    ];

    // Estilo de encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Agregar datos
    datos.forEach((row, index) => {
      const dataRow = worksheet.addRow(row);
      
      // Alternar colores de filas
      if (index % 2 === 0) {
        dataRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
      }

      // Formatear calificación
      dataRow.getCell('Calificacion_Promedio').numFmt = '0.00';
      
      // Colorear estado
      const estadoCell = dataRow.getCell('Estado');
      switch (row.Estado) {
        case 'aprobado':
          estadoCell.font = { color: { argb: 'FF28A745' }, bold: true };
          break;
        case 'rechazado':
          estadoCell.font = { color: { argb: 'FFDC3545' }, bold: true };
          break;
        case 'finalizado':
          estadoCell.font = { color: { argb: 'FF007BFF' }, bold: true };
          break;
      }

      // Colorear memoria técnica
      const memoriaCell = dataRow.getCell('Memoria_Tecnica');
      if (row.Memoria_Tecnica === 'Sí') {
        memoriaCell.font = { color: { argb: 'FF28A745' }, bold: true };
      } else {
        memoriaCell.font = { color: { argb: 'FFDC3545' } };
      }
    });

    // Agregar filtros automáticos
    worksheet.autoFilter = {
      from: 'A1',
      to: `M1`
    };

    // Congelar primera fila
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Crear hoja de resumen
    const resumenSheet = workbook.addWorksheet('Resumen');
    
    // Estadísticas generales
    const [[stats]] = await db.query(`
      SELECT 
        COUNT(DISTINCT pr.id) AS total_promociones,
        COUNT(DISTINCT e.id) AS total_especialidades,
        COUNT(DISTINCT c.id) AS total_cursos,
        COUNT(DISTINCT p.id) AS total_proyectos,
        COUNT(DISTINCT CASE WHEN af.id IS NOT NULL THEN p.id END) AS proyectos_con_memoria,
        COUNT(DISTINCT CASE WHEN n.id IS NOT NULL THEN p.id END) AS proyectos_calificados
      FROM proyectos p
      JOIN cursos c ON c.id = p.curso_id
      JOIN especialidades e ON e.id = c.especialidad_id
      JOIN promociones pr ON pr.id = c.promocion_id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      LEFT JOIN notas n ON n.proyecto_id = p.id
      WHERE p.eliminado = 0
    `);

    resumenSheet.addRow(['RESUMEN GENERAL']);
    resumenSheet.addRow(['']);
    resumenSheet.addRow(['Concepto', 'Cantidad']);
    resumenSheet.addRow(['Promociones', stats.total_promociones]);
    resumenSheet.addRow(['Especialidades', stats.total_especialidades]);
    resumenSheet.addRow(['Cursos', stats.total_cursos]);
    resumenSheet.addRow(['Proyectos Totales', stats.total_proyectos]);
    resumenSheet.addRow(['Proyectos con Memoria Técnica', stats.proyectos_con_memoria]);
    resumenSheet.addRow(['Proyectos Calificados', stats.proyectos_calificados]);
    resumenSheet.addRow(['']);
    resumenSheet.addRow(['Fecha de generación:', new Date().toLocaleString('es-EC')]);

    // Estilo del resumen
    resumenSheet.getColumn(1).width = 35;
    resumenSheet.getColumn(2).width = 20;
    resumenSheet.getRow(1).font = { bold: true, size: 14 };
    resumenSheet.getRow(3).font = { bold: true };
    resumenSheet.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E2E2' }
    };

    // Generar nombre del archivo
    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Reporte_General_Proyectos_${fechaHoy}.xlsx`;

    // Configurar headers de respuesta
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}"`
    );

    // Escribir y enviar
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

// =====================================================
// DESCARGAR EXCEL POR ESPECIALIDAD/PROMOCIÓN
// =====================================================
router.get('/excel/:especialidad_id/:promocion_id', verifyToken, async (req, res) => {
  try {
    const { id, rol } = req.user;
    const { especialidad_id, promocion_id } = req.params;

    // Verificar permisos
    if (rol === 'tutor') {
      const [[acceso]] = await db.query(`
        SELECT 1 FROM tutor_curso tc
        JOIN cursos c ON c.id = tc.curso_id
        WHERE tc.tutor_id = ? 
          AND c.especialidad_id = ? 
          AND c.promocion_id = ?
        LIMIT 1
      `, [id, especialidad_id, promocion_id]);

      if (!acceso) {
        return res.status(403).json({ msg: 'No tienes acceso a estos datos' });
      }
    }

    // Obtener datos filtrados
    const [datos] = await db.query(`
      SELECT 
        CONCAT(c.nombre, ' ', c.paralelo) AS Curso,
        p.titulo AS Proyecto,
        p.descripcion AS Descripcion,
        p.estado AS Estado,
        u.nombre AS Tutor,
        COALESCE(AVG(n.calificacion), 0) AS Calificacion_Promedio,
        IF(af.id IS NOT NULL, 'Sí', 'No') AS Memoria_Tecnica
      FROM proyectos p
      JOIN cursos c ON c.id = p.curso_id
      JOIN usuarios u ON u.id = p.tutor_id
      LEFT JOIN notas n ON n.proyecto_id = p.id
      LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
      WHERE p.eliminado = 0
        AND c.especialidad_id = ?
        AND c.promocion_id = ?
      GROUP BY p.id
      ORDER BY c.nombre, p.titulo
    `, [especialidad_id, promocion_id]);

    if (datos.length === 0) {
      return res.status(404).json({ msg: 'No hay datos para esta combinación' });
    }

    // Obtener info de especialidad y promoción
    const [[info]] = await db.query(`
      SELECT e.nombre AS especialidad, pr.anio AS promocion
      FROM especialidades e, promociones pr
      WHERE e.id = ? AND pr.id = ?
    `, [especialidad_id, promocion_id]);

    // Crear Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Proyectos');

    worksheet.columns = [
      { header: 'Curso', key: 'Curso', width: 15 },
      { header: 'Proyecto', key: 'Proyecto', width: 40 },
      { header: 'Descripción', key: 'Descripcion', width: 50 },
      { header: 'Estado', key: 'Estado', width: 15 },
      { header: 'Tutor', key: 'Tutor', width: 30 },
      { header: 'Calificación', key: 'Calificacion_Promedio', width: 15 },
      { header: 'Memoria', key: 'Memoria_Tecnica', width: 15 }
    ];

    // Estilo de encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // Agregar datos
    datos.forEach(row => {
      worksheet.addRow(row);
    });

    const nombreArchivo = `Proyectos_${info.especialidad.replace(/\s/g, '_')}_${info.promocion}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Error al generar Excel filtrado:', err);
    if (!res.headersSent) {
      res.status(500).json({ msg: 'Error al generar Excel' });
    }
  }
});

module.exports = router;