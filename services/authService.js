// services/authService.js
const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const User = require('../models/User');

class AuthService {
  generateToken(user) {
    return jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, config.jwtSecret, {
      expiresIn: '7d',
    });
  }

  verifyToken(token) {
    return jwt.verify(token, config.jwtSecret);
  }

  async googleVerify(idToken) {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(config.googleClientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    let user = await User.findOne({ email: payload.email });
    if (!user) {
      user = new User({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
        avatar: payload.picture,
      });
      await user.save();
    }
    return user;
  }
}

module.exports = new AuthService();
