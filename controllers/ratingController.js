// controllers/ratingController.js
const Anime = require('../models/Anime');
const Episode = require('../models/Episode');
const Rating = require('../models/Rating');

exports.rateAnime = async (req, res) => {
  const { animeId, rating } = req.body;
  const anime = await Anime.findById(animeId);
  if (!anime) return res.status(404).json({ message: 'Anime not found' });
  anime.userRatings = anime.userRatings.filter(r => r.user.toString() !== req.user._id.toString());
  anime.userRatings.push({ user: req.user._id, rating });
  anime.averageRating = anime.calculateAverageRating();
  await anime.save();
  res.json(anime);
};

exports.rateEpisode = async (req, res) => {
  const { episodeId, rating } = req.body;
  const ep = await Episode.findById(episodeId);
  if (!ep) return res.status(404).json({ message: 'Episode not found' });
  ep.userRatings = ep.userRatings.filter(r => r.user.toString() !== req.user._id.toString());
  ep.userRatings.push({ user: req.user._id, rating });
  ep.averageRating = ep.userRatings.reduce((a, c) => a + c.rating, 0) / ep.userRatings.length;
  await ep.save();
  res.json(ep);
};
