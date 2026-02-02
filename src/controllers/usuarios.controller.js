const db = require('../config/database');

exports.getUsuarios = async (req,res)=>{
    const [rows] = await db.query('SELECT id,nombre,correo,rol,especialidad FROM usuarios');
    res.json(rows);
};
