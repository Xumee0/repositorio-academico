require('dotenv').config();
const app = require('./src/app');

app.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});
