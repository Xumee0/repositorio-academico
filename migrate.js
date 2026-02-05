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
  log('║     MIGRACIÓN DE BASE DE DATOS - RAILWAY          ║', 'cyan');
  log('║     Sistema Repositorio Académico v2.0            ║', 'cyan');
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
    const sqlPath = path.join(__dirname, 'migracion_completa.sql');
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`No se encuentra el archivo: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    log('✅ Script SQL cargado correctamente\n', 'green');

    // Confirmar antes de continuar
    log('⚠️  ADVERTENCIA:', 'red');
    log('   Esta migración modificará la estructura de tu base de datos.', 'yellow');
    log('   Asegúrate de haber hecho un BACKUP antes de continuar.', 'yellow');
    log('');

    // Mostrar resumen de cambios
    log('📝 Cambios que se aplicarán:', 'cyan');
    log('   • Cambiar roles: docente → tutor', 'cyan');
    log('   • Eliminar rol: estudiante', 'cyan');
    log('   • Renombrar: docente_curso → tutor_curso', 'cyan');
    log('   • Eliminar tabla: estudiante_curso', 'cyan');
    log('   • Modificar tabla proyectos: agregar tutor_id, eliminar estudiante_id', 'cyan');
    log('   • Actualizar tabla notas: docente_id → tutor_id', 'cyan');
    log('');

    // Esperar 3 segundos para que el usuario pueda leer
    log('⏳ Iniciando en 3 segundos... (Ctrl+C para cancelar)', 'yellow');
    await sleep(3000);

    // Ejecutar migración
    log('\n🚀 EJECUTANDO MIGRACIÓN...', 'bright');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    
    const startTime = Date.now();
    await connection.query(sql);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log(`✅ MIGRACIÓN COMPLETADA EN ${duration} segundos\n`, 'green');

    // Verificaciones post-migración
    log('🔍 Verificando cambios...', 'yellow');
    log('');

    // 1. Verificar roles
    log('1️⃣  Roles de usuarios:', 'cyan');
    const [roles] = await connection.query(
      'SELECT rol, COUNT(*) as total FROM usuarios GROUP BY rol'
    );
    roles.forEach(r => {
      const icon = r.rol === 'admin' ? '👑' : '📚';
      log(`   ${icon} ${r.rol}: ${r.total} usuarios`, 'green');
    });
    log('');

    // 2. Verificar tablas
    log('2️⃣  Tablas en la base de datos:', 'cyan');
    const [tablas] = await connection.query('SHOW TABLES');
    const nombreBD = `Tables_in_${config.database}`;
    
    const tablasEsperadas = ['tutor_curso', 'proyectos', 'notas'];
    const tablasNoDeberias = ['docente_curso', 'estudiante_curso'];
    
    tablasEsperadas.forEach(tabla => {
      const existe = tablas.some(t => t[nombreBD] === tabla);
      if (existe) {
        log(`   ✅ ${tabla}`, 'green');
      } else {
        log(`   ❌ ${tabla} NO ENCONTRADA`, 'red');
      }
    });

    tablasNoDeberias.forEach(tabla => {
      const existe = tablas.some(t => t[nombreBD] === tabla);
      if (!existe) {
        log(`   ✅ ${tabla} correctamente eliminada`, 'green');
      } else {
        log(`   ⚠️  ${tabla} AÚN EXISTE (debería estar eliminada)`, 'yellow');
      }
    });
    log('');

    // 3. Verificar estructura de proyectos
    log('3️⃣  Estructura de tabla proyectos:', 'cyan');
    const [columnasProyectos] = await connection.query(
      'DESCRIBE proyectos'
    );
    
    const tieneTutorId = columnasProyectos.some(c => c.Field === 'tutor_id');
    const tieneEstudianteId = columnasProyectos.some(c => c.Field === 'estudiante_id');
    
    if (tieneTutorId) {
      log('   ✅ Columna tutor_id presente', 'green');
    } else {
      log('   ❌ Columna tutor_id NO encontrada', 'red');
    }
    
    if (!tieneEstudianteId) {
      log('   ✅ Columna estudiante_id eliminada correctamente', 'green');
    } else {
      log('   ⚠️  Columna estudiante_id AÚN EXISTE', 'yellow');
    }
    log('');

    // 4. Verificar proyectos sin tutor
    log('4️⃣  Integridad de datos:', 'cyan');
    const [[stats]] = await connection.query(`
      SELECT 
        COUNT(*) as total_proyectos,
        COUNT(tutor_id) as con_tutor,
        COUNT(*) - COUNT(tutor_id) as sin_tutor
      FROM proyectos
      WHERE eliminado = 0
    `);
    
    log(`   📊 Total proyectos: ${stats.total_proyectos}`, 'green');
    log(`   ✅ Con tutor asignado: ${stats.con_tutor}`, 'green');
    
    if (stats.sin_tutor > 0) {
      log(`   ⚠️  Sin tutor: ${stats.sin_tutor} (REQUIERE ATENCIÓN)`, 'red');
    } else {
      log(`   ✅ Todos los proyectos tienen tutor asignado`, 'green');
    }
    log('');

    // 5. Verificar estructura de notas
    log('5️⃣  Estructura de tabla notas:', 'cyan');
    const [columnasNotas] = await connection.query('DESCRIBE notas');
    
    const tieneTutorIdNotas = columnasNotas.some(c => c.Field === 'tutor_id');
    const tieneDocenteId = columnasNotas.some(c => c.Field === 'docente_id');
    
    if (tieneTutorIdNotas) {
      log('   ✅ Columna tutor_id presente', 'green');
    } else {
      log('   ❌ Columna tutor_id NO encontrada', 'red');
    }
    
    if (!tieneDocenteId) {
      log('   ✅ Columna docente_id eliminada correctamente', 'green');
    } else {
      log('   ⚠️  Columna docente_id AÚN EXISTE', 'yellow');
    }
    log('');

    // Resumen final
    log('═══════════════════════════════════════════════════', 'green');
    log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE', 'green');
    log('═══════════════════════════════════════════════════', 'green');
    log('');
    log('📋 Próximos pasos:', 'cyan');
    log('   1. Actualizar el código del backend con las nuevas rutas', 'cyan');
    log('   2. Actualizar el frontend (tutor.html, admin.html)', 'cyan');
    log('   3. Probar el login como tutor', 'cyan');
    log('   4. Verificar creación de proyectos', 'cyan');
    log('   5. Probar descarga de ZIPs y Excel', 'cyan');
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
    log('   • Verifica que el archivo migracion_completa.sql existe', 'yellow');
    log('   • Revisa que las credenciales de la BD sean correctas', 'yellow');
    log('   • Asegúrate de tener permisos para modificar la estructura', 'yellow');
    log('   • Si ya ejecutaste parte de la migración, revisa el estado actual', 'yellow');
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
