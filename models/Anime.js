// backend/models/Anime.js
const mongoose = require('mongoose');

const animeSchema = new mongoose.Schema({
  malId: { type: Number, unique: true, sparse: true },
  title: { type: String, required: true },
  titleEnglish: { type: String },
  titleJapanese: { type: String },
  synopsis: { type: String },
  poster: { type: String },
  type: { type: String, enum: ['TV', 'Movie', 'OVA', 'Special', 'ONA'] },
  status: { type: String, enum: ['Airing', 'Completed', 'Upcoming'] },
  startDate: { type: Date },
  endDate: { type: Date },
  genres: [{ type: String }],
  studios: [{ type: String }],
  source: { type: String },
  duration: { type: String },
  rating: { type: String },
  popularity: { type: Number },
  rank: { type: Number },
  episodes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Episode' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userRatings: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 10 },
    createdAt: { type: Date, default: Date.now }
  }],
  averageRating: { type: Number, default: 0 },
}, { timestamps: true });

animeSchema.methods.calculateAverageRating = function() {
  if (this.userRatings.length === 0) return 0;
  const sum = this.userRatings.reduce((acc, rating) => acc + rating.rating, 0);
  return (sum / this.userRatings.length).toFixed(1);
};

module.exports = mongoose.model('Anime', animeSchema);
