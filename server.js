const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ruta de prueba (salud básica)
app.get('/', (req, res) => {
  res.send('I GUIDE U backend funcionando');
});

// Ruta de salud (para chequear si el backend está vivo)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend online' });
});

// Ejemplo de ruta usuarios (más adelante conectaremos a MongoDB)
app.get('/api/usuarios', (req, res) => {
  res.json([{ id: 1, nombre: 'Usuario demo' }]);
});

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB conectado'))
.catch((error) => console.error('Error al conectar MongoDB:', error));

app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
