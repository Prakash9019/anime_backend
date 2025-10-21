// backend/models/Rating.js
const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  anime: { type: mongoose.Schema.Types.ObjectId, ref: 'Anime' },
  episode: { type: mongoose.Schema.Types.ObjectId, ref: 'Episode' },
  rating: { type: Number, required: true, min: 1, max: 10 },
  review: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Rating', ratingSchema);
