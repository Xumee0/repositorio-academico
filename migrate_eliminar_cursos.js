require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function migrate() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║   MIGRACIÓN: ELIMINAR CURSOS - RAILWAY            ║', 'cyan');
  log('║   Sistema Repositorio Académico v3.0              ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');

  // Configuración de conexión
  const config = {
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
    multipleStatements: true // IMPORTANTE: permite ejecutar múltiples queries
  };

  log('📋 Configuración de conexión:', 'blue');
  log(`   Host: ${config.host}`, 'blue');
  log(`   Port: ${config.port}`, 'blue');
  log(`   User: ${config.user}`, 'blue');
  log(`   Database: ${config.database}`, 'blue');
  log('');

  let connection;

  try {
    // Crear conexión
    log('🔌 Conectando a la base de datos...', 'yellow');
    connection = await mysql.createConnection(config);
    log('✅ Conexión establecida exitosamente\n', 'green');

    // Leer el archivo SQL
    log('📄 Cargando script de migración...', 'yellow');
    const sqlPath = path.join(__dirname, 'eliminar cursos.sql');
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`No se encuentra el archivo: ${sqlPath}`);
    }

    let sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Remover comentarios que causan problemas en multipleStatements
    // Mantener solo las queries SQL ejecutables
    sql = sql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Eliminar líneas de comentarios completos
        return !trimmed.startsWith('--') && trimmed !== '';
      })
      .join('\n');
    
    log('✅ Script SQL cargado correctamente\n', 'green');

    // Confirmar antes de continuar
    log('⚠️  ADVERTENCIA:', 'red');
    log('   Esta migración modificará la estructura de tu base de datos.', 'yellow');
    log('   ⚡ Railway hace backups automáticos, pero es buena práctica verificar.', 'yellow');
    log('');

    // Mostrar resumen de cambios
    log('📝 Cambios que se aplicarán:', 'cyan');
    log('   • Agregar columnas: promocion_id y especialidad_id a proyectos', 'cyan');
    log('   • Migrar datos existentes desde cursos', 'cyan');
    log('   • Eliminar columna: curso_id de proyectos', 'cyan');
    log('   • Eliminar tabla: tutor_curso', 'cyan');
    log('   • Actualizar constraint único de proyectos', 'cyan');
    log('   • (OPCIONAL) Eliminar tabla: cursos', 'cyan');
    log('');

    log('📊 Estructura ANTES de la migración:', 'magenta');
    log('   proyectos → curso → promoción + especialidad', 'magenta');
    log('');
    log('📊 Estructura DESPUÉS de la migración:', 'green');
    log('   proyectos → promoción + especialidad (directo)', 'green');
    log('');

    // Esperar 3 segundos para que el usuario pueda leer
    log('⏳ Iniciando en 3 segundos... (Ctrl+C para cancelar)', 'yellow');
    await sleep(3000);

    // Ejecutar migración
    log('\n🚀 EJECUTANDO MIGRACIÓN...', 'bright');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    
    const startTime = Date.now();
    
    // Dividir en queries individuales para mejor control
    const queries = sql.split(';').filter(q => q.trim().length > 0);
    
    let queryNum = 1;
    for (const query of queries) {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 0 && !trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('SHOW') && !trimmedQuery.startsWith('DESCRIBE')) {
        try {
          await connection.query(trimmedQuery);
          log(`   ✅ Query ${queryNum}/${queries.length} ejecutada`, 'green');
          queryNum++;
        } catch (err) {
          // Si el error es por constraint o columna que ya existe, continuar
          if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            log(`   ⚠️  Query ${queryNum}/${queries.length} - Ya aplicada previamente`, 'yellow');
            queryNum++;
          } else {
            throw err;
          }
        }
      }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log(`✅ MIGRACIÓN COMPLETADA EN ${duration} segundos\n`, 'green');

    // Verificaciones post-migración
    log('🔍 Verificando cambios...', 'yellow');
    log('');

    // 1. Verificar estructura de proyectos
    log('1️⃣  Estructura de tabla proyectos:', 'cyan');
    const [columnasProyectos] = await connection.query('DESCRIBE proyectos');
    
    const tienePromocionId = columnasProyectos.some(c => c.Field === 'promocion_id');
    const tieneEspecialidadId = columnasProyectos.some(c => c.Field === 'especialidad_id');
    const tieneCursoId = columnasProyectos.some(c => c.Field === 'curso_id');
    
    if (tienePromocionId) {
      log('   ✅ Columna promocion_id presente', 'green');
    } else {
      log('   ❌ Columna promocion_id NO encontrada', 'red');
    }
    
    if (tieneEspecialidadId) {
      log('   ✅ Columna especialidad_id presente', 'green');
    } else {
      log('   ❌ Columna especialidad_id NO encontrada', 'red');
    }
    
    if (!tieneCursoId) {
      log('   ✅ Columna curso_id eliminada correctamente', 'green');
    } else {
      log('   ⚠️  Columna curso_id AÚN EXISTE (pendiente de eliminar)', 'yellow');
    }
    log('');

    // 2. Verificar integridad de datos
    log('2️⃣  Integridad de datos:', 'cyan');
    const [[stats]] = await connection.query(`
      SELECT 
        COUNT(*) as total_proyectos,
        COUNT(promocion_id) as con_promocion,
        COUNT(especialidad_id) as con_especialidad,
        COUNT(*) - COUNT(promocion_id) as sin_promocion
      FROM proyectos
      WHERE eliminado = 0
    `);
    
    log(`   📊 Total proyectos: ${stats.total_proyectos}`, 'green');
    log(`   ✅ Con promoción: ${stats.con_promocion}`, 'green');
    log(`   ✅ Con especialidad: ${stats.con_especialidad}`, 'green');
    
    if (stats.sin_promocion > 0) {
      log(`   ⚠️  Sin promoción: ${stats.sin_promocion} (REQUIERE ATENCIÓN)`, 'red');
    } else {
      log(`   ✅ Todos los proyectos tienen promoción y especialidad`, 'green');
    }
    log('');

    // 3. Verificar tablas
    log('3️⃣  Verificación de tablas:', 'cyan');
    const [tablas] = await connection.query('SHOW TABLES');
    const nombreBD = `Tables_in_${config.database}`;
    
    const existeTutorCurso = tablas.some(t => t[nombreBD] === 'tutor_curso');
    const existeCursos = tablas.some(t => t[nombreBD] === 'cursos');
    
    if (!existeTutorCurso) {
      log('   ✅ Tabla tutor_curso eliminada correctamente', 'green');
    } else {
      log('   ⚠️  Tabla tutor_curso AÚN EXISTE', 'yellow');
    }
    
    if (existeCursos) {
      log('   ℹ️  Tabla cursos conservada (puede eliminarse manualmente si deseas)', 'blue');
    } else {
      log('   ✅ Tabla cursos eliminada', 'green');
    }
    log('');

    // 4. Verificar foreign keys
    log('4️⃣  Foreign keys de proyectos:', 'cyan');
    const [fks] = await connection.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'proyectos' 
        AND TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    fks.forEach(fk => {
      log(`   ✅ ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}`, 'green');
    });
    log('');

    // 5. Mostrar ejemplo de proyectos
    log('5️⃣  Vista previa de proyectos:', 'cyan');
    const [proyectos] = await connection.query(`
      SELECT 
        p.id,
        p.titulo,
        pr.anio AS promocion,
        e.nombre AS especialidad,
        u.nombre AS tutor
      FROM proyectos p
      LEFT JOIN promociones pr ON pr.id = p.promocion_id
      LEFT JOIN especialidades e ON e.id = p.especialidad_id
      LEFT JOIN usuarios u ON u.id = p.tutor_id
      WHERE p.eliminado = 0
      ORDER BY pr.anio DESC, e.nombre, p.titulo
      LIMIT 5
    `);
    
    if (proyectos.length > 0) {
      proyectos.forEach(p => {
        log(`   📚 ${p.titulo}`, 'green');
        log(`      └─ ${p.promocion || 'Sin promoción'} - ${p.especialidad || 'Sin especialidad'} - Tutor: ${p.tutor || 'Sin tutor'}`, 'blue');
      });
    } else {
      log('   ℹ️  No hay proyectos activos en la base de datos', 'blue');
    }
    log('');

    // Resumen final
    log('═══════════════════════════════════════════════════', 'green');
    log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE', 'green');
    log('═══════════════════════════════════════════════════', 'green');
    log('');
    log('📋 Próximos pasos:', 'cyan');
    log('   1. ✅ Actualizar el código del backend para usar promocion_id y especialidad_id', 'cyan');
    log('   2. ✅ Actualizar el frontend (admin.html, tutor.html)', 'cyan');
    log('   3. ✅ Eliminar referencias a cursos en el código', 'cyan');
    log('   4. ✅ Probar creación de proyectos con nueva estructura', 'cyan');
    log('   5. ✅ Si todo funciona, puedes eliminar la tabla cursos manualmente', 'cyan');
    log('');
    log('💡 Tip: Si algo sale mal, Railway mantiene backups automáticos', 'yellow');
    log('');

  } catch (error) {
    log('\n❌ ERROR DURANTE LA MIGRACIÓN:', 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    
    if (error.code) {
      log(`   Código de error: ${error.code}`, 'red');
    }
    if (error.sqlMessage) {
      log(`   Mensaje SQL: ${error.sqlMessage}`, 'red');
    }
    if (error.sql) {
      log(`   Query: ${error.sql.substring(0, 200)}...`, 'red');
    }
    
    log(`   ${error.message}`, 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    
    log('\n💡 Sugerencias:', 'yellow');
    log('   • Verifica que el archivo "eliminar cursos.sql" existe', 'yellow');
    log('   • Revisa que las credenciales de la BD sean correctas', 'yellow');
    log('   • Asegúrate de tener permisos para modificar la estructura', 'yellow');
    log('   • Railway mantiene backups, puedes restaurar si es necesario', 'yellow');
    log('');
    
    throw error;
    
  } finally {
    if (connection) {
      await connection.end();
      log('🔌 Conexión a base de datos cerrada\n', 'blue');
    }
  }
}

// Función auxiliar para sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecutar migración
migrate()
  .then(() => {
    log('✨ Proceso completado con éxito', 'green');
    process.exit(0);
  })
  .catch((err) => {
    log('💥 El proceso finalizó con errores', 'red');
    process.exit(1);
  });
