const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3001,
  sheetdbUrl: process.env.SHEETDB_URL,
  sheetdbAuth: process.env.SHEETDB_AUTH_LOGIN
    ? {
        login: process.env.SHEETDB_AUTH_LOGIN,
        password: process.env.SHEETDB_AUTH_PASSWORD,
      }
    : null,
  jwtSecret: process.env.JWT_SECRET,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};
