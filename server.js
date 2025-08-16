// Conectar a Mongo solo si hay variable definida y no es localhost
const uri = process.env.MONGODB_URI;

if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB conectado'))
    .catch((error) => console.error('Error al conectar MongoDB:', error));
} else {
  console.log('Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}
