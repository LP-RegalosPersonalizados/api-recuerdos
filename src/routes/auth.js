const { Router } = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password requeridos' });
  }

  if (email !== config.adminEmail || password !== config.adminPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { email: config.adminEmail },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  res.json({ token, email: config.adminEmail });
});

router.get('/verify', require('../middleware/auth').authenticate, (req, res) => {
  res.json({ valid: true, email: req.user.email });
});

module.exports = router;
