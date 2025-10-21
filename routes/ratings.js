// routes/ratings.js
const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const ratingController = require('../controllers/ratingController');

const router = express.Router();

router.post(
  '/anime',
  auth,
  [
    body('animeId').isMongoId(),
    body('rating').isInt({ min: 1, max: 10 }),
  ],
  ratingController.rateAnime
);

router.post(
  '/episode',
  auth,
  [
    body('episodeId').isMongoId(),
    body('rating').isInt({ min: 1, max: 10 }),
  ],
  ratingController.rateEpisode
);

module.exports = router;
