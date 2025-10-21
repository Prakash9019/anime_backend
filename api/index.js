// api/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const userRoutes = require('../routes/user');
const authRoutes = require('../routes/auth');
const animeRoutes = require('../routes/anime');
const adminRoutes = require('../routes/admin');
const ratingRoutes = require('../routes/ratings');
const paymentRoutes = require('../routes/payment');
const adRoutes = require('../routes/ads');
const adminAccountRoutes = require('../routes/adminAccount');
const adminAuthRoutes = require('../routes/adminAuth');

const stripe = require('../config/stripe');
const Donation = require('../models/Donation');
const User = require('../models/User');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/account', adminAccountRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ratings', ratingRoutes);

// Webhook endpoint
app.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const isLive = process.env.PAYMENT_ENV === 'production';
    const secret = isLive
      ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
      : process.env.STRIPE_WEBHOOK_SECRET_TEST;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error('Webhook signature mismatch', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const userId = pi.metadata.userId;
      const amount = pi.amount / 100;
      const paymentId = pi.id;

      const donation = new Donation({
        user: userId,
        amount,
        paymentMethod: 'card',
        paymentId,
        status: 'completed',
      });
      await donation.save();

      await User.findByIdAndUpdate(userId, {
        isAdFree: true,
        adFreeGrantedAt: new Date(),
      });

      console.log(`Donation recorded for user ${userId}: ₹${amount}`);
    }

    res.json({ received: true });
  }
);

app.get('/', (req, res) => res.send('Welcome to AnimeFlow API'));
app.get('/health', (req, res) => res.send('Server is healthy ✅'));
app.get('/hello', (req, res) => res.json('API is running'));

// ✅ Use the port Render provides, or 3001 for local testing
const PORT = process.env.PORT || 3001;

// ✅ Listen on 0.0.0.0 to accept connections from Render's proxy
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
