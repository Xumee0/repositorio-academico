require('dotenv').config();
const mysql = require('mysql2/promise');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkStatus() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║   VERIFICACIÓN DE ESTADO - MIGRACIÓN BD           ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');

  const connectionUrl = process.env.MYSQL_PUBLIC_URL || 
    `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`;

  let connection;

  try {
    connection = await mysql.createConnection(connectionUrl);
    log('✅ Conectado a la base de datos\n', 'green');

    // Verificar tablas
    log('📋 ESTADO DE TABLAS:', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    
    const [tables] = await connection.query('SHOW TABLES');
    const tableField = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[tableField]);

    const checks = [
      { name: 'tutor_curso', should: 'exist', exists: tableNames.includes('tutor_curso') },
      { name: 'docente_curso', should: 'not_exist', exists: tableNames.includes('docente_curso') },
      { name: 'estudiante_curso', should: 'not_exist', exists: tableNames.includes('estudiante_curso') },
      { name: 'proyectos', should: 'exist', exists: tableNames.includes('proyectos') },
      { name: 'notas', should: 'exist', exists: tableNames.includes('notas') },
      { name: 'usuarios', should: 'exist', exists: tableNames.includes('usuarios') }
    ];

    checks.forEach(check => {
      const isCorrect = check.should === 'exist' ? check.exists : !check.exists;
      const icon = isCorrect ? '✅' : '❌';
      const status = check.exists ? 'Existe' : 'No existe';
      const expected = check.should === 'exist' ? '(debe existir)' : '(no debe existir)';
      log(`  ${icon} ${check.name}: ${status} ${expected}`, isCorrect ? 'green' : 'red');
    });

    // Verificar columnas en proyectos
    log('\n📋 COLUMNAS EN TABLA PROYECTOS:', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    
    try {
      const [proyectosColumns] = await connection.query('DESCRIBE proyectos');
      const proyectosFields = proyectosColumns.map(c => c.Field);
      
      const proyectosChecks = [
        { name: 'tutor_id', should: 'exist', exists: proyectosFields.includes('tutor_id') },
        { name: 'estudiante_id', should: 'not_exist', exists: proyectosFields.includes('estudiante_id') },
        { name: 'curso_id', should: 'exist', exists: proyectosFields.includes('curso_id') },
        { name: 'titulo', should: 'exist', exists: proyectosFields.includes('titulo') }
      ];

      proyectosChecks.forEach(check => {
        const isCorrect = check.should === 'exist' ? check.exists : !check.exists;
        const icon = isCorrect ? '✅' : '❌';
        const status = check.exists ? 'Existe' : 'No existe';
        log(`  ${icon} ${check.name}: ${status}`, isCorrect ? 'green' : 'red');
      });
    } catch (err) {
      log('  ❌ No se pudo verificar tabla proyectos', 'red');
    }

    // Verificar columnas en notas
    log('\n📋 COLUMNAS EN TABLA NOTAS:', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    
    try {
      const [notasColumns] = await connection.query('DESCRIBE notas');
      const notasFields = notasColumns.map(c => c.Field);
      
      const notasChecks = [
        { name: 'tutor_id', should: 'exist', exists: notasFields.includes('tutor_id') },
        { name: 'docente_id', should: 'not_exist', exists: notasFields.includes('docente_id') },
        { name: 'proyecto_id', should: 'exist', exists: notasFields.includes('proyecto_id') }
      ];

      notasChecks.forEach(check => {
        const isCorrect = check.should === 'exist' ? check.exists : !check.exists;
        const icon = isCorrect ? '✅' : '❌';
        const status = check.exists ? 'Existe' : 'No existe';
        log(`  ${icon} ${check.name}: ${status}`, isCorrect ? 'green' : 'red');
      });
    } catch (err) {
      log('  ❌ No se pudo verificar tabla notas', 'red');
    }

    // Verificar roles
    log('\n📋 ROLES DE USUARIOS:', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    
    const [roles] = await connection.query('SELECT rol, COUNT(*) as total FROM usuarios GROUP BY rol');
    roles.forEach(r => {
      const icon = ['admin', 'tutor'].includes(r.rol) ? '✅' : '⚠️';
      const marker = r.rol === 'admin' ? '👑' : r.rol === 'tutor' ? '📚' : '👤';
      log(`  ${icon} ${marker} ${r.rol}: ${r.total} usuarios`, icon === '✅' ? 'green' : 'yellow');
    });

    // Verificar integridad
    log('\n📊 INTEGRIDAD DE DATOS:', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    
    const [[proyectos]] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(tutor_id) as con_tutor,
        COUNT(*) - COUNT(tutor_id) as sin_tutor
      FROM proyectos
      WHERE eliminado = 0
    `);
    
    log(`  📁 Proyectos totales: ${proyectos.total}`, 'green');
    log(`  ✅ Con tutor asignado: ${proyectos.con_tutor}`, 'green');
    
    if (proyectos.sin_tutor > 0) {
      log(`  ❌ Sin tutor: ${proyectos.sin_tutor} (ATENCIÓN REQUERIDA)`, 'red');
    } else {
      log(`  ✅ Todos los proyectos tienen tutor`, 'green');
    }

    const [[notas]] = await connection.query('SELECT COUNT(*) as total FROM notas');
    log(`  📝 Notas totales: ${notas.total}`, 'green');

    // Diagnóstico general
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('📋 DIAGNÓSTICO GENERAL:', 'cyan');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

    const todoOk = 
      tableNames.includes('tutor_curso') &&
      !tableNames.includes('docente_curso') &&
      !tableNames.includes('estudiante_curso') &&
      proyectos.sin_tutor === 0 &&
      roles.every(r => ['admin', 'tutor'].includes(r.rol));

    if (todoOk) {
      log('✅ MIGRACIÓN COMPLETADA AL 100%', 'green');
      log('   Todos los cambios se aplicaron correctamente', 'green');
    } else {
      log('⚠️  MIGRACIÓN PARCIAL', 'yellow');
      log('   Algunos cambios aún están pendientes', 'yellow');
      log('   Ejecuta: node migrate_smart.js', 'yellow');
    }

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkStatus()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));