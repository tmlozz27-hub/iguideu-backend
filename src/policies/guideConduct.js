function public() {
  return {
    policy: 'guide-conduct',
    principles: [
      'Prioriza la seguridad del cliente; verifica rutas, tiempos y condiciones.',
      'Evita cobros excesivos por parte de vendedores terceros; protege al viajero.',
      'Ofrece siempre la calidad de información que a ti te gustaría recibir.',
      'Eres el primer representante de tu cultura ante el viajero.',
      'Comunicación clara y respetuosa, puntualidad y cumplimiento.',
    ],
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { public };
