const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

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
