const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint base
app.get('/', (req, res) => {
  res.send('I GUIDE U backend funcionando');
});

// Endpoint de prueba de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint de ejemplo de usuarios
app.get('/api/usuarios', (req, res) => {
  res.json([
    { id: 1, nombre: 'Juan', pais: 'Argentina' },
    { id: 2, nombre: 'Maria', pais: 'España' },
    { id: 3, nombre: 'Lucas', pais: 'México' }
  ]);
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
