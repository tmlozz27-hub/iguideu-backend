// models/Usuario.js
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, minlength: 2 },
  email:  { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  passwordHash: { type: String }, // puede ser null si se crea por otra vía
}, { timestamps: true });

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);
