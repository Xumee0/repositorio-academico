const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    // Intentar obtener token de header Authorization
    let authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader) {
        // Extraer token del formato "Bearer TOKEN"
        token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;
    }

    // Si no hay token en header, intentar desde query params (para descargas)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    // Si aún no hay token, rechazar
    if (!token) {
        return res.status(403).json({msg:'Sin token'});
    }

    // Verificar el token
    jwt.verify(token, 'secreto', (err, decoded) => {
        if (err) {
            return res.status(401).json({msg:'Token inválido'});
        }
        req.user = decoded;
        next();
    });
};