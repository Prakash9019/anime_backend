const Stripe = require('stripe');
const isLive = process.env.PAYMENT_ENV === 'production';
const key = isLive
  ? process.env.STRIPE_SECRET_KEY_LIVE
  : process.env.STRIPE_SECRET_KEY_TEST;
module.exports = new Stripe(key);
