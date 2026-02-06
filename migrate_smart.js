require('dotenv').config();
const mysql = require('mysql2/promise');

// Colores
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkTableExists(connection, tableName) {
  const [tables] = await connection.query('SHOW TABLES');
  const tableField = Object.keys(tables[0])[0];
  return tables.some(t => t[tableField] === tableName);
}

async function checkColumnExists(connection, tableName, columnName) {
  try {
    const [columns] = await connection.query(`DESCRIBE ${tableName}`);
    return columns.some(c => c.Field === columnName);
  } catch (err) {
    return false;
  }
}

async function checkRoleExists(connection, roleName) {
  try {
    const [[result]] = await connection.query(
      'SELECT COUNT(*) as count FROM usuarios WHERE rol = ?',
      [roleName]
    );
    return result.count > 0;
  } catch (err) {
    return false;
  }
}

async function migrate() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║   MIGRACIÓN INTELIGENTE - CONTINUAR DESDE AQUÍ    ║', 'cyan');
  log('║     Sistema Repositorio Académico v2.0            ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');

  // Configuración
  const connectionUrl = process.env.MYSQL_PUBLIC_URL || 
    `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`;

  let connection;

  try {
    log('🔌 Conectando a la base de datos...', 'yellow');
    connection = await mysql.createConnection(connectionUrl);
    log('✅ Conectado\n', 'green');

    // ===============================================
    // DETECTAR ESTADO ACTUAL
    // ===============================================
    log('🔍 Detectando estado actual de la base de datos...', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

    const estado = {
      tutorCursoExists: await checkTableExists(connection, 'tutor_curso'),
      docenteCursoExists: await checkTableExists(connection, 'docente_curso'),
      estudianteCursoExists: await checkTableExists(connection, 'estudiante_curso'),
      proyectosTieneTutorId: await checkColumnExists(connection, 'proyectos', 'tutor_id'),
      proyectosTieneEstudianteId: await checkColumnExists(connection, 'proyectos', 'estudiante_id'),
      notasTieneTutorId: await checkColumnExists(connection, 'notas', 'tutor_id'),
      notasTieneDocenteId: await checkColumnExists(connection, 'notas', 'docente_id'),
      existeRolTutor: await checkRoleExists(connection, 'tutor'),
      existeRolDocente: await checkRoleExists(connection, 'docente'),
      existeRolEstudiante: await checkRoleExists(connection, 'estudiante')
    };

    // Mostrar estado
    log('Estado de tablas:', 'blue');
    log(`  tutor_curso: ${estado.tutorCursoExists ? '✅ Existe' : '❌ No existe'}`, estado.tutorCursoExists ? 'green' : 'red');
    log(`  docente_curso: ${estado.docenteCursoExists ? '⚠️ Existe (debería eliminarse)' : '✅ No existe'}`, estado.docenteCursoExists ? 'yellow' : 'green');
    log(`  estudiante_curso: ${estado.estudianteCursoExists ? '⚠️ Existe (debería eliminarse)' : '✅ No existe'}`, estado.estudianteCursoExists ? 'yellow' : 'green');
    
    log('\nEstado de columnas en proyectos:', 'blue');
    log(`  tutor_id: ${estado.proyectosTieneTutorId ? '✅ Existe' : '❌ No existe'}`, estado.proyectosTieneTutorId ? 'green' : 'red');
    log(`  estudiante_id: ${estado.proyectosTieneEstudianteId ? '⚠️ Existe (debería eliminarse)' : '✅ No existe'}`, estado.proyectosTieneEstudianteId ? 'yellow' : 'green');
    
    log('\nEstado de columnas en notas:', 'blue');
    log(`  tutor_id: ${estado.notasTieneTutorId ? '✅ Existe' : '❌ No existe'}`, estado.notasTieneTutorId ? 'green' : 'red');
    log(`  docente_id: ${estado.notasTieneDocenteId ? '⚠️ Existe (debería eliminarse)' : '✅ No existe'}`, estado.notasTieneDocenteId ? 'yellow' : 'green');

    log('\nEstado de roles:', 'blue');
    log(`  tutor: ${estado.existeRolTutor ? '✅ Existe' : '❌ No existe'}`, estado.existeRolTutor ? 'green' : 'red');
    log(`  docente: ${estado.existeRolDocente ? '⚠️ Existe (debería cambiarse a tutor)' : '✅ No existe'}`, estado.existeRolDocente ? 'yellow' : 'green');
    log(`  estudiante: ${estado.existeRolEstudiante ? '⚠️ Existe (debería eliminarse)' : '✅ No existe'}`, estado.existeRolEstudiante ? 'yellow' : 'green');

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

    // ===============================================
    // EJECUTAR SOLO LO QUE FALTA
    // ===============================================
    log('\n🚀 Ejecutando cambios necesarios...', 'bright');
    log('');

    let cambiosRealizados = 0;

    // PASO 1: Cambiar roles (si aún hay docentes o estudiantes)
    if (estado.existeRolDocente || estado.existeRolEstudiante) {
      log('📝 Paso 1: Actualizando roles...', 'cyan');
      
      if (estado.existeRolDocente) {
        await connection.query("UPDATE usuarios SET rol = 'tutor' WHERE rol = 'docente'");
        log('  ✅ docente → tutor', 'green');
        cambiosRealizados++;
      }
      
      if (estado.existeRolEstudiante) {
        await connection.query("UPDATE usuarios SET rol = 'admin' WHERE rol IN ('admin', 'secretaria')");
        log('  ✅ Consolidados admin/secretaria', 'green');
        cambiosRealizados++;
      }
      
      // Actualizar enum de roles
      try {
        await connection.query("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin','tutor') NOT NULL");
        log('  ✅ Enum de roles actualizado', 'green');
        cambiosRealizados++;
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          log(`  ⚠️ Error al actualizar enum: ${err.message}`, 'yellow');
        }
      }
    } else {
      log('✅ Paso 1: Roles ya actualizados', 'green');
    }

    // PASO 2: Renombrar docente_curso si existe
    if (estado.docenteCursoExists && !estado.tutorCursoExists) {
      log('\n📝 Paso 2: Renombrando docente_curso → tutor_curso...', 'cyan');
      await connection.query('RENAME TABLE docente_curso TO tutor_curso');
      log('  ✅ Tabla renombrada', 'green');
      cambiosRealizados++;
      
      // Renombrar columna
      await connection.query('ALTER TABLE tutor_curso CHANGE docente_id tutor_id INT NOT NULL');
      log('  ✅ Columna docente_id → tutor_id', 'green');
      
      // Actualizar constraints
      try {
        await connection.query('ALTER TABLE tutor_curso DROP KEY uq_docente_curso');
      } catch (err) {}
      
      try {
        await connection.query('ALTER TABLE tutor_curso ADD UNIQUE KEY uq_tutor_curso (tutor_id, curso_id)');
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          log(`  ⚠️ ${err.message}`, 'yellow');
        }
      }
    } else if (estado.tutorCursoExists) {
      log('\n✅ Paso 2: tutor_curso ya existe', 'green');
    }

    // PASO 3: Modificar tabla proyectos
    if (!estado.proyectosTieneTutorId) {
      log('\n📝 Paso 3: Agregando tutor_id a proyectos...', 'cyan');
      
      await connection.query('ALTER TABLE proyectos ADD COLUMN tutor_id INT NULL AFTER curso_id');
      log('  ✅ Columna tutor_id agregada', 'green');
      cambiosRealizados++;
      
      // Asignar tutores
      await connection.query(`
        UPDATE proyectos p
        SET p.tutor_id = (
          SELECT tc.tutor_id FROM tutor_curso tc WHERE tc.curso_id = p.curso_id LIMIT 1
        )
        WHERE p.tutor_id IS NULL
      `);
      log('  ✅ Tutores asignados desde cursos', 'green');
      
      // Asignar tutor por defecto a los que quedaron sin asignar
      await connection.query(`
        UPDATE proyectos p
        SET p.tutor_id = (SELECT id FROM usuarios WHERE rol IN ('admin', 'tutor') LIMIT 1)
        WHERE p.tutor_id IS NULL
      `);
      log('  ✅ Tutores por defecto asignados', 'green');
      
      // Hacer NOT NULL
      await connection.query('ALTER TABLE proyectos MODIFY COLUMN tutor_id INT NOT NULL');
      log('  ✅ tutor_id ahora es obligatorio', 'green');
      
      // Agregar foreign key
      try {
        await connection.query(`
          ALTER TABLE proyectos 
          ADD CONSTRAINT fk_proyectos_tutor 
          FOREIGN KEY (tutor_id) REFERENCES usuarios(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        log('  ✅ Foreign key agregada', 'green');
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          log(`  ⚠️ ${err.message}`, 'yellow');
        }
      }
    } else {
      log('\n✅ Paso 3: tutor_id ya existe en proyectos', 'green');
    }

    // PASO 4: Eliminar estudiante_id de proyectos
    if (estado.proyectosTieneEstudianteId) {
      log('\n📝 Paso 4: Eliminando estudiante_id de proyectos...', 'cyan');
      
      // Eliminar foreign key primero
      try {
        await connection.query('ALTER TABLE proyectos DROP FOREIGN KEY proyectos_ibfk_1');
      } catch (err) {
        log(`  ⚠️ Foreign key ya eliminada o no existe`, 'yellow');
      }
      
      await connection.query('ALTER TABLE proyectos DROP COLUMN estudiante_id');
      log('  ✅ Columna estudiante_id eliminada', 'green');
      cambiosRealizados++;
      
      // Actualizar unique key
      try {
        await connection.query('ALTER TABLE proyectos DROP KEY uq_proyecto_estudiante_curso');
      } catch (err) {}
      
      try {
        await connection.query('ALTER TABLE proyectos ADD UNIQUE KEY uq_proyecto_titulo_curso (titulo, curso_id)');
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          log(`  ⚠️ ${err.message}`, 'yellow');
        }
      }
    } else {
      log('\n✅ Paso 4: estudiante_id ya eliminado de proyectos', 'green');
    }

    // PASO 5: Modificar tabla notas
    if (estado.notasTieneDocenteId && !estado.notasTieneTutorId) {
      log('\n📝 Paso 5: Actualizando tabla notas...', 'cyan');
      
      // Eliminar foreign key
      try {
        await connection.query('ALTER TABLE notas DROP FOREIGN KEY notas_ibfk_2');
      } catch (err) {}
      
      // Renombrar columna
      await connection.query('ALTER TABLE notas CHANGE docente_id tutor_id INT NOT NULL');
      log('  ✅ Columna docente_id → tutor_id', 'green');
      cambiosRealizados++;
      
      // Agregar foreign key
      try {
        await connection.query(`
          ALTER TABLE notas 
          ADD CONSTRAINT fk_notas_tutor 
          FOREIGN KEY (tutor_id) REFERENCES usuarios(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          log(`  ⚠️ ${err.message}`, 'yellow');
        }
      }
      
      // Actualizar unique key
      try {
        await connection.query('ALTER TABLE notas DROP KEY uq_nota_docente_proyecto');
      } catch (err) {}
      
      try {
        await connection.query('ALTER TABLE notas ADD UNIQUE KEY uq_nota_tutor_proyecto (proyecto_id, tutor_id)');
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          log(`  ⚠️ ${err.message}`, 'yellow');
        }
      }
    } else if (estado.notasTieneTutorId) {
      log('\n✅ Paso 5: Notas ya actualizadas', 'green');
    }

    // PASO 6: Eliminar estudiante_curso
    if (estado.estudianteCursoExists) {
      log('\n📝 Paso 6: Eliminando tabla estudiante_curso...', 'cyan');
      await connection.query('DROP TABLE IF EXISTS estudiante_curso');
      log('  ✅ Tabla eliminada', 'green');
      cambiosRealizados++;
    } else {
      log('\n✅ Paso 6: estudiante_curso ya eliminada', 'green');
    }

    // ===============================================
    // VERIFICACIÓN FINAL
    // ===============================================
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🔍 Verificación final...', 'cyan');
    log('');

    const [roles] = await connection.query('SELECT rol, COUNT(*) as total FROM usuarios GROUP BY rol');
    log('Roles actuales:', 'blue');
    roles.forEach(r => {
      const icon = r.rol === 'admin' ? '👑' : '📚';
      log(`  ${icon} ${r.rol}: ${r.total}`, 'green');
    });

    const [[stats]] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(tutor_id) as con_tutor
      FROM proyectos WHERE eliminado = 0
    `);
    log(`\nProyectos: ${stats.total} totales, ${stats.con_tutor} con tutor`, 'green');

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    
    if (cambiosRealizados > 0) {
      log(`🎉 MIGRACIÓN COMPLETADA - ${cambiosRealizados} cambios realizados`, 'green');
    } else {
      log('🎉 BASE DE DATOS YA ESTABA ACTUALIZADA', 'green');
    }
    
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');

  } catch (error) {
    log('\n❌ ERROR:', 'red');
    log(`   ${error.message}`, 'red');
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));