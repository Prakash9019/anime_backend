// config/auth.js
require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  malClientId: process.env.MAL_CLIENT_ID,
  malClientSecret: process.env.MAL_CLIENT_SECRET,
  redirectUri: process.env.MAL_REDIRECT_URI,
};
