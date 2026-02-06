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

// Función para limpiar el SQL de comentarios
function cleanSQL(sql) {
  // Eliminar comentarios de bloque /* ... */
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Eliminar comentarios de línea --
  sql = sql.split('\n')
    .map(line => {
      const commentIndex = line.indexOf('--');
      if (commentIndex !== -1) {
        return line.substring(0, commentIndex);
      }
      return line;
    })
    .join('\n');
  
  // Eliminar líneas vacías y espacios extra
  sql = sql.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  return sql;
}

// Función para extraer queries ejecutables
function extractQueries(sql) {
  const queries = [];
  const statements = sql.split(';');
  
  for (const statement of statements) {
    const trimmed = statement.trim();
    
    // Solo incluir queries que empiecen con palabras clave SQL válidas
    if (trimmed.length > 0) {
      const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
      const validKeywords = ['ALTER', 'CREATE', 'DROP', 'UPDATE', 'INSERT', 'DELETE', 'TRUNCATE', 'RENAME'];
      
      if (validKeywords.includes(firstWord)) {
        queries.push(trimmed);
      }
    }
  }
  
  return queries;
}

async function migrate() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║   MIGRACIÓN: ELIMINAR CURSOS - RAILWAY            ║', 'cyan');
  log('║   Sistema Repositorio Académico v3.0              ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');

  // Configuración de conexión - PRIORIZAR CREDENCIALES PÚBLICAS
  const config = {
    host: process.env.DB_HOST_PUBLIC || process.env.MYSQLHOST || process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT_PUBLIC || process.env.MYSQLPORT || process.env.DB_PORT || '3306'),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
    connectTimeout: 10000
  };

  log('📋 Configuración de conexión:', 'blue');
  log(`   Host: ${config.host}`, 'blue');
  log(`   Port: ${config.port}`, 'blue');
  log(`   User: ${config.user}`, 'blue');
  log(`   Database: ${config.database}`, 'blue');
  
  // Detectar si estamos usando hostname interno
  if (config.host && config.host.includes('.railway.internal')) {
    log('', '');
    log('⚠️  ADVERTENCIA: Usando hostname interno de Railway', 'yellow');
    log('   Esto solo funciona desde DENTRO de Railway.', 'yellow');
    log('', '');
    log('💡 Para ejecutar DESDE TU COMPUTADORA:', 'cyan');
    log('   1. Ve a Railway Dashboard → Tu base de datos', 'cyan');
    log('   2. Click en "Connect"', 'cyan');
    log('   3. Copia el "Public Network Host"', 'cyan');
    log('   4. Agrega a tu archivo .env:', 'cyan');
    log('      DB_HOST_PUBLIC=monorail.proxy.rlwy.net', 'green');
    log('      DB_PORT_PUBLIC=12345', 'green');
    log('   5. Vuelve a ejecutar este script', 'cyan');
    log('', '');
  }
  
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
    
    // Limpiar SQL de comentarios
    log('🧹 Limpiando comentarios del SQL...', 'yellow');
    sql = cleanSQL(sql);
    
    // Extraer queries ejecutables
    const queries = extractQueries(sql);
    log(`✅ ${queries.length} queries detectadas para ejecutar\n`, 'green');

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
    
    let executedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      
      try {
        await connection.query(query);
        executedCount++;
        
        // Mostrar tipo de query ejecutada
        const firstWord = query.split(/\s+/)[0].toUpperCase();
        log(`   ✅ [${i + 1}/${queries.length}] ${firstWord}`, 'green');
        
      } catch (err) {
        // Manejar errores conocidos que son "seguros" de ignorar
        if (err.code === 'ER_DUP_FIELDNAME') {
          skippedCount++;
          log(`   ⚠️  [${i + 1}/${queries.length}] Columna ya existe - saltado`, 'yellow');
        } else if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          skippedCount++;
          log(`   ⚠️  [${i + 1}/${queries.length}] No se puede eliminar (no existe) - saltado`, 'yellow');
        } else if (err.code === 'ER_DUP_KEYNAME') {
          skippedCount++;
          log(`   ⚠️  [${i + 1}/${queries.length}] Constraint ya existe - saltado`, 'yellow');
        } else if (err.code === 'ER_BAD_TABLE_ERROR') {
          skippedCount++;
          log(`   ⚠️  [${i + 1}/${queries.length}] Tabla no existe - saltado`, 'yellow');
        } else {
          // Error real - lanzar excepción
          log(`\n   ❌ Error en query ${i + 1}:`, 'red');
          log(`   ${query.substring(0, 100)}...`, 'red');
          throw err;
        }
      }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log(`✅ MIGRACIÓN COMPLETADA EN ${duration} segundos`, 'green');
    log(`   📊 Ejecutadas: ${executedCount} | Saltadas: ${skippedCount}\n`, 'green');

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
    
    if (fks.length > 0) {
      fks.forEach(fk => {
        log(`   ✅ ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}`, 'green');
      });
    } else {
      log('   ℹ️  No se encontraron foreign keys', 'blue');
    }
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
    
    // Mensaje específico para error de DNS/conexión
    if (error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND') {
      log('', '');
      log('   🔍 ERROR DE CONEXIÓN - No se puede resolver el hostname', 'red');
      log('', '');
      log('   💡 SOLUCIÓN: Usa credenciales públicas de Railway', 'yellow');
      log('   Ver: COMO_OBTENER_CREDENCIALES_RAILWAY.md', 'cyan');
      log('', '');
    }
    
    if (error.sqlMessage) {
      log(`   Mensaje SQL: ${error.sqlMessage}`, 'red');
    }
    if (error.sql) {
      const shortQuery = error.sql.length > 200 ? error.sql.substring(0, 200) + '...' : error.sql;
      log(`   Query: ${shortQuery}`, 'red');
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