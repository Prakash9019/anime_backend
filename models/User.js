// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  avatar: { type: String },
  isAdmin: { type: Boolean, default: false },
    isAdFree: { type: Boolean, default: false },
  adFreeGrantedAt: { type: Date },
  watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Anime' }],
  ratings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Rating' }],
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
