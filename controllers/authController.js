// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');

const jwksClient = require('jwks-rsa');
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { googleId, name, email, avatar } = req.body;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = new User({ googleId, name, email, avatar });
      await user.save();
    }

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const APPLE_ISS = 'https://appleid.apple.com';
const APPLE_JWKS_URL = `${APPLE_ISS}/auth/keys`;

const client = jwksClient({
  jwksUri: APPLE_JWKS_URL,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24h
});

/**
 * getSigningKey: returns a Promise that resolves to PEM public key for given kid
 */
function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
}

/**
 * POST /auth/apple
 * Body: { identityToken: string, email?: string, name?: string }
 */
exports.appleAuth = async (req, res) => {
  try {
    const { identityToken, email: clientEmail, name: clientName } = req.body;

    if (!identityToken) {
      return res.status(400).json({ message: 'identityToken is required' });
    }

    // Decode header to find kid
    const decodedHeader = jwt.decode(identityToken, { complete: true });
    if (!decodedHeader || !decodedHeader.header) {
      return res.status(400).json({ message: 'Invalid identity token' });
    }
    const { kid, alg } = decodedHeader.header;

    // Get signing key from Apple's JWKS
    let publicKey;
    try {
      publicKey = await getSigningKey(kid);
    } catch (err) {
      console.error('Failed to get signing key from Apple JWKS', err);
      return res.status(401).json({ message: 'Invalid identity token (no key)' });
    }

    // Verify token signature and claims. This will also check 'exp' automatically.
    let payload;
    try {
      // set audience to your client id (bundle id or service id)
      const expectedAud = process.env.APPLE_CLIENT_ID;
      const verifyOptions = {
        algorithms: ['RS256'],
        issuer: APPLE_ISS,
        // audience: expectedAud, // we will check manually to give clearer message
      };

      payload = jwt.verify(identityToken, publicKey, verifyOptions);
    } catch (err) {
      console.error('Apple identity token verify failed:', err);
      return res.status(401).json({ message: 'Invalid identity token (verify failed)' });
    }

    // verify aud explicitly (gives clearer error than jwt.verify's audience option)
    const aud = payload.aud;
    const expectedAud = process.env.APPLE_CLIENT_ID;
    if (!expectedAud) {
      console.warn('APPLE_CLIENT_ID not configured; skipping aud check');
    } else if (aud !== expectedAud) {
      // Sometimes aud is an array; handle both
      const audOK = Array.isArray(aud) ? aud.includes(expectedAud) : aud === expectedAud;
      if (!audOK) {
        console.warn('Apple identity token aud mismatch:', { aud, expectedAud });
        return res.status(401).json({ message: 'Invalid audience in identity token' });
      }
    }

    // verify issuer - jwt.verify already checked iss, but double check:
    if (payload.iss !== APPLE_ISS) {
      return res.status(401).json({ message: 'Invalid token issuer' });
    }

    // Now payload is trusted. Get the unique subject (Apple user id).
    const appleSub = payload.sub; // unique user id from Apple
    const emailFromToken = payload.email ?? clientEmail; // Apple may or may not include email
    const emailVerified = payload.email_verified; // may be 'true'|'false' or boolean

    if (!appleSub && !emailFromToken) {
      return res.status(400).json({ message: 'No identifiable user information from token' });
    }

    // Find existing user by appleId or email
    let user = null;
    if (appleSub) {
      user = await User.findOne({ appleId: appleSub });
    }
    if (!user && emailFromToken) {
      user = await User.findOne({ email: emailFromToken });
    }

    // If user doesn't exist, create one
    if (!user) {
      user = new User({
        appleId: appleSub,
        email: emailFromToken,
        name: clientName || payload.name || payload['name'] || '',
      });
      await user.save();
    } else {
      // If user found by email and doesn't have appleId, attach it
      if (appleSub && !user.appleId) {
        user.appleId = appleSub;
        await user.save();
      }
    }

    // generate your JWT session token
    const token = generateToken(user._id);

    // return the same shape your frontend expects (token + user)
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || null,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (error) {
    console.error('appleAuth error', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
