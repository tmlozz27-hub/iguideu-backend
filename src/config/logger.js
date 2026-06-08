import winston from 'winston';
const { combine, timestamp, printf, colorize } = winston.format;
const logFormat = printf(({ level, message, timestamp, stack }) => `${timestamp} [${level}] ${stack || message}`);
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), logFormat),
  transports: [new winston.transports.Console({ format: combine(colorize(), timestamp(), logFormat) })]
});
