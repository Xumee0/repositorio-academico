const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({msg:'Sin token'});

    jwt.verify(token, 'secreto', (err, decoded) => {
        if (err) return res.status(401).json({msg:'Token inválido'});
        req.user = decoded;
        next();
    });
};
