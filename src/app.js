const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const app = express();

app.use(compression());
app.use(express.json());

if (config.nodeEnv !== 'production') {
  app.use(morgan('dev'));
}

const corsOrigins = config.corsOrigins === '*'
  ? '*'
  : config.corsOrigins;
app.use(cors({ origin: corsOrigins }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login. Intenta de nuevo en un minuto.' },
});

app.use('/api', authLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/trabajos', require('./routes/trabajos'));

app.get('/', (req, res) => {
  res.json({
    name: 'Recuerdos Compartidos API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth/login',
      productos: '/api/productos',
      trabajos: '/api/trabajos',
    },
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno', message: err.message });
});

module.exports = app;
