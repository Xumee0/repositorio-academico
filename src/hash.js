const bcrypt = require('bcryptjs');
bcrypt.hash('123456', 10).then(console.log);
