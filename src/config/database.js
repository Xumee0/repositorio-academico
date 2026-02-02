const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'repo_user',
    password: 'Repo123!',
    database: 'repositorio'
});

module.exports = pool.promise();
