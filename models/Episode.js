// backend/models/Episode.js
const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
  anime: { type: mongoose.Schema.Types.ObjectId, ref: 'Anime', required: true },
  number: { type: Number, required: true },
  title: { type: String, required: true },
  synopsis: { type: String },
  airDate: { type: Date },
  duration: { type: String },
  thumbnail: { type: String },
  userRatings: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 10 },
    createdAt: { type: Date, default: Date.now }
  }],
  averageRating: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Episode', episodeSchema);
