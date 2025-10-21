// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const animeRoutes = require('./routes/anime');
const adminRoutes = require('./routes/admin');
const ratingRoutes = require('./routes/ratings');
const paymentRoutes = require('./routes/payment');
const stripe = require('./config/stripe');
const Donation = require('./models/Donation');
const User = require('./models/User');
const bodyParser = require('body-parser');
const app = express();

// Middleware
app.use(cors());
// app.use(cors({
//   allowedHeaders: ['X-User-Auth', 'Content-Type'],
// }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Database connection
// Make sure to set the MONGO_URI environment variable in your Cloud Run service.
mongoose.connect('mongodb+srv://plsprakash2003:Surya_2003@cluster0.2yh1df7.mongodb.net/anime_flow?retryWrites=true&w=majority&ssl=true')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
// backend/server.js (add this line)
// backend/server.js (add ads routes)
const adRoutes = require('./routes/ads');
const adminAccountRoutes = require('./routes/adminAccount');
// backend/server.js
const adminAuthRoutes = require('./routes/adminAuth');

// Add routes
app.use('/api/admin/auth', adminAuthRoutes);

app.use('/api/admin/account', adminAccountRoutes);

// Add with your other routes
app.use('/api/ads', adRoutes);
app.use('/api/payment', paymentRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ratings', ratingRoutes);
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

    // Handle the event
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const userId = pi.metadata.userId;
      const amount = pi.amount / 100;
      const paymentId = pi.id;

      // Record donation
      const donation = new Donation({
        user: userId,
        amount,
        paymentMethod: 'card',
        paymentId,
        status: 'completed'
      });
      await donation.save();

      // Grant ad-free access
      await User.findByIdAndUpdate(userId, {
        isAdFree: true,
        adFreeGrantedAt: new Date()
      });

      console.log(`Donation recorded for user ${userId}: ₹${amount}`);
    }

    // Return 200 to acknowledge receipt
    res.json({ received: true });
  }
);
app.get('/', (req, res) => {
  res.send('Welcome to AnimeFlow API');
});
app.get('/health', (req, res) => {
  res.send('Welcome to AnimeFlow API');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});

