const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({msg:'Sin token'});

    // Extraer token del formato "Bearer TOKEN"
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

    jwt.verify(token, 'secreto', (err, decoded) => {
        if (err) return res.status(401).json({msg:'Token inválido'});
        req.user = decoded;
        next();
    });
};