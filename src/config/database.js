const mysql = require('mysql2/promise');

const pool = mysql.createPool(process.env.MYSQL_PUBLIC_URL);

// =========================
// PRUEBA DE CONEXIÓN (TEMPORAL)
// =========================
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado a la base de datos correctamente');
    connection.release();
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
  }
})();
module.exports = pool;
