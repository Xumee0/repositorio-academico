const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

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
