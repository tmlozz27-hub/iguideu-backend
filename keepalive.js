require('./server.js');
// Mantiene el event loop ocupado aunque server.js termine su script principal
setInterval(() => {}, 1 << 30);
