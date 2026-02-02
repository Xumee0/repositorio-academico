const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req,res)=>{
    const {nombre, correo, password, rol, especialidad} = req.body;
    const hash = await bcrypt.hash(password,10);

    await db.query(
        'INSERT INTO usuarios(nombre,correo,password,rol,especialidad) VALUES (?,?,?,?,?)',
        [nombre,correo,hash,rol,especialidad]
    );

    res.json({msg:'Usuario creado'});
};

exports.login = async (req,res)=>{
    const {correo,password} = req.body;

    const [rows] = await db.query('SELECT * FROM usuarios WHERE correo=?',[correo]);
    if(rows.length===0) return res.status(404).json({msg:'No existe'});

    const valid = await bcrypt.compare(password, rows[0].password);
    if(!valid) return res.status(401).json({msg:'Contraseña incorrecta'});

    const token = jwt.sign({id:rows[0].id, rol:rows[0].rol}, 'secreto');
    res.json({token, rol: rows[0].rol});
};
