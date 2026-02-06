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

// Función mejorada para limpiar SQL de comentarios
function cleanSQL(sql) {
  let cleaned = '';
  let inBlockComment = false;
  let inLineComment = false;
  
  const lines = sql.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let processedLine = '';
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = j + 1 < line.length ? line[j + 1] : '';
      
      // Detectar inicio de comentario de bloque
      if (!inBlockComment && !inLineComment && char === '/' && nextChar === '*') {
        inBlockComment = true;
        j++; // Saltar el siguiente carácter
        continue;
      }
      
      // Detectar fin de comentario de bloque
      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        j++; // Saltar el siguiente carácter
        continue;
      }
      
      // Detectar comentario de línea
      if (!inBlockComment && !inLineComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        break; // Ignorar el resto de la línea
      }
      
      // Si no estamos en un comentario, agregar el carácter
      if (!inBlockComment && !inLineComment) {
        processedLine += char;
      }
    }
    
    // Resetear comentario de línea al final de cada línea
    inLineComment = false;
    
    // Agregar la línea procesada si tiene contenido
    if (processedLine.trim().length > 0) {
      cleaned += processedLine + '\n';
    }
  }
  
  return cleaned;
}

// Función para extraer queries ejecutables
function extractQueries(sql) {
  const queries = [];
  
  // Dividir por punto y coma
  const statements = sql.split(';');
  
  for (const statement of statements) {
    const trimmed = statement.trim();
    
    if (trimmed.length === 0) continue;
    
    // Solo incluir queries que empiecen con palabras clave SQL válidas
    const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
    const validKeywords = ['ALTER', 'CREATE', 'DROP', 'UPDATE', 'INSERT', 'DELETE', 'TRUNCATE', 'RENAME'];
    
    // También excluir queries de verificación
    const skipKeywords = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC'];
    
    if (validKeywords.includes(firstWord) && !skipKeywords.includes(firstWord)) {
      queries.push(trimmed);
    }
  }
  
  return queries;
}

async function migrate() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║   MIGRACIÓN: ELIMINAR CURSOS - RAILWAY            ║', 'cyan');
  log('║   Sistema Repositorio Académico v3.0              ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝\n', 'cyan');

  // Configuración de conexión
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
    log('');

    log('📊 Estructura ANTES:', 'magenta');
    log('   proyectos → curso → promoción + especialidad', 'magenta');
    log('📊 Estructura DESPUÉS:', 'green');
    log('   proyectos → promoción + especialidad (directo)', 'green');
    log('');

    // Esperar 3 segundos
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
        const tableName = extractTableName(query);
        log(`   ✅ [${i + 1}/${queries.length}] ${firstWord} ${tableName}`, 'green');
        
      } catch (err) {
        // Manejar errores conocidos que son "seguros" de ignorar
        const safeErrors = {
          'ER_DUP_FIELDNAME': 'Columna ya existe',
          'ER_CANT_DROP_FIELD_OR_KEY': 'No se puede eliminar (no existe)',
          'ER_DUP_KEYNAME': 'Constraint ya existe',
          'ER_BAD_TABLE_ERROR': 'Tabla no existe',
          'ER_BAD_FIELD_ERROR': 'Campo no existe',
          'ER_DROP_INDEX_FK': 'Foreign key relacionada existe'
        };
        
        if (safeErrors[err.code]) {
          skippedCount++;
          log(`   ⚠️  [${i + 1}/${queries.length}] ${safeErrors[err.code]} - saltado`, 'yellow');
        } else {
          // Error real - mostrar y lanzar
          log(`\n   ❌ Error en query ${i + 1}:`, 'red');
          log(`   Tipo: ${err.code || 'UNKNOWN'}`, 'red');
          log(`   Query: ${query.substring(0, 150)}...`, 'red');
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
      log('', '');
      log('   💡 Solución: Ejecuta este SQL manualmente:', 'yellow');
      log('   UPDATE proyectos SET promocion_id = 1, especialidad_id = 1 WHERE promocion_id IS NULL;', 'cyan');
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
      log('   ℹ️  Tabla cursos conservada (puede eliminarse manualmente)', 'blue');
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
    log('5️⃣  Vista previa de proyectos (primeros 5):', 'cyan');
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
      ORDER BY p.id DESC
      LIMIT 5
    `);
    
    if (proyectos.length > 0) {
      proyectos.forEach(p => {
        const status = (p.promocion && p.especialidad) ? '✅' : '⚠️';
        log(`   ${status} ${p.titulo}`, p.promocion ? 'green' : 'yellow');
        log(`      └─ ${p.promocion || 'Sin promoción'} | ${p.especialidad || 'Sin especialidad'} | ${p.tutor || 'Sin tutor'}`, 'blue');
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
    log('   1. ✅ Actualizar backend: usar promocion_id y especialidad_id', 'cyan');
    log('   2. ✅ Actualizar frontend: remover referencias a cursos', 'cyan');
    log('   3. ✅ Probar crear proyectos con nueva estructura', 'cyan');
    log('   4. ✅ Verificar que todo funciona correctamente', 'cyan');
    log('   5. 🗑️  (Opcional) Eliminar tabla cursos si ya no la necesitas', 'cyan');
    log('');
    log('💡 Tip: Railway mantiene backups automáticos por 7 días', 'yellow');
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
      const shortQuery = error.sql.length > 200 ? error.sql.substring(0, 200) + '...' : error.sql;
      log(`   Query: ${shortQuery}`, 'red');
    }
    
    log(`   ${error.message}`, 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    
    log('\n💡 Sugerencias:', 'yellow');
    log('   • Verifica permisos de modificación en Railway', 'yellow');
    log('   • Revisa que la base de datos esté disponible', 'yellow');
    log('   • Si continúa fallando, contacta soporte de Railway', 'yellow');
    log('');
    
    throw error;
    
  } finally {
    if (connection) {
      await connection.end();
      log('🔌 Conexión a base de datos cerrada\n', 'blue');
    }
  }
}

// Función auxiliar para extraer nombre de tabla
function extractTableName(query) {
  const alterMatch = query.match(/ALTER\s+TABLE\s+(\w+)/i);
  if (alterMatch) return `(${alterMatch[1]})`;
  
  const dropMatch = query.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
  if (dropMatch) return `(${dropMatch[1]})`;
  
  const updateMatch = query.match(/UPDATE\s+(\w+)/i);
  if (updateMatch) return `(${updateMatch[1]})`;
  
  return '';
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