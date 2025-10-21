const express = require('express');
// NOTE: Use environment variable for the secret key for production/testing
// For testing, set process.env.STRIPE_SECRET_KEY to 'sk_test_...'
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_TEST ); // Fallback to your test key

const User = require('../models/User'); // Assuming these models exist
const Donation = require('../models/Donation');
const auth = require('../middleware/auth'); // Assuming auth middleware exists

const router = express.Router();

// 1. Create donation payment intent (Called by PaymentModal.tsx)
router.post('/create-donation-intent', auth, async (req, res) => {
  try {
    const { amount } = req.body; // Amount is expected in cents (e.g., 100 for $1.00)
    
    // Server-side validation of the minimum amount
    if (amount < 100) { // Minimum $1.00 donation = 100 cents
      return res.status(400).json({ message: 'Minimum donation amount is 100 cents ($1.00)' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Use the amount in cents
      currency: 'usd',
      metadata: {
        userId: req.user._id.toString(), // Assuming auth middleware provides req.user
        type: 'donation'
      },automatic_payment_methods: {
        enabled: true,
      },
    });
       console.log("heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error("Stripe Error:", error);
    res.status(500).json({ message: 'Payment intent creation failed', error: error.message });
  }
});

// 2. Confirm donation and grant ad-free access (Called by PaymentModal.tsx after successful client confirmation)
router.post('/confirm-donation', auth, async (req, res) => {
  try {
       console.log("heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    const { paymentIntentId, amount } = req.body; // amount here is the dollar amount for logging/display
       console.log("heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
      console.log("Confirm Donation Request:", { paymentIntentId, amount, userId: req.user._id });
       console.log("heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    // 1. Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
       console.log("heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    
    // Check if the status is 'succeeded' and the amount matches (optional but recommended)
    if (paymentIntent.status === 'succeeded' && paymentIntent.amount === Math.round(amount * 100)) { 
      
      // 2. Create donation record
      const donation = new Donation({
        user: req.user._id,
        amount: amount, // Store the dollar amount
        paymentIntentId: paymentIntentId,
        status: 'completed'
      });
      await donation.save();
      console.log(`Donation recorded for user ${req.user._id}: $${amount}`);
      // 3. Grant ad-free access
       console.log("heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
      await User.findByIdAndUpdate(req.user._id, {
        isAdFree: true,
        adFreeGrantedAt: new Date()
      });
       console.log("heeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
      res.json({ message: 'Donation confirmed and ad-free access granted' });
    } else {
      // Log the unexpected status or mismatch
      res.status(400).json({ message: `Payment not completed. Status: ${paymentIntent.status}` });
    }
  } catch (error) {
    console.error("Confirmation Error:", error);
    res.status(500).json({ message: 'Donation confirmation failed', error: error.message });
  }
});

// routes/payment.js
router.post('/create-subscription', auth, async (req, res) => {
  try {
    const { priceId } = req.body; // Stripe Price ID (recurring plan)

    // 1. Fetch or create Stripe Customer for this user
    const user = await User.findById(req.user._id);
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user._id.toString() },
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    // 2. Create Subscription
    const subscription = await stripe.subscriptions.create({
      customer: user.stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    res.json({
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ message: 'Subscription creation failed', error: error.message });
  }
});


router.post('/confirm-subscription', auth, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      await User.findByIdAndUpdate(req.user._id, {
        isSubscribed: true,
        subscriptionId,
      });
      return res.json({ message: 'Subscription activated!' });
    }

    res.status(400).json({ message: `Subscription not active. Status: ${subscription.status}` });
  } catch (error) {
    console.error("Subscription Confirmation Error:", error);
    res.status(500).json({ message: 'Failed to confirm subscription', error: error.message });
  }
});


module.exports = router;