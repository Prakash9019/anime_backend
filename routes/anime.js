// // backend/routes/anime.js
// const express = require('express');
// const animeController = require('../controllers/animeController');
// const adminController = require('../controllers/adminController');
// const auth = require('../middleware/auth');
// const admin = require('../middleware/admin');
// const router = express.Router();

// router.get('/', animeController.getAnimeList);
// router.get('/:id', animeController.getAnimeById);
// router.post('/rate', auth, animeController.rateAnime);
// router.post('/rate-episode', auth, animeController.rateEpisode);
// router.post('/sync-mal', animeController.syncWithMAL);
// // backend/routes/anime.js (ADD ROUTES)
// router.post('/sync-episodes', [auth, admin], animeController.syncAllEpisodes);
// router.post('/:id/sync-episodes', [auth, admin], animeController.syncEpisodesFromJikan);

// // backend/routes/admin.js (ADD ROUTES)
// router.post('/anime/:animeId/episodes', [auth, admin], adminController.addEpisode);
// router.post('/anime/:animeId/sync-episodes', [auth, admin], adminController.syncEpisodesFromJikan);

// module.exports = router;

// backend/routes/anime.js
const express = require('express');
const animeController = require('../controllers/animeController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Public routes
router.get('/', animeController.getAnimeList);
router.get('/:id', animeController.getAnimeById);
router.put('/:id', animeController.updateAnimeDetails);
// User routes (requires authentication)
router.post('/rate', auth, animeController.rateAnime);
router.post('/rate-episode', auth, animeController.rateEpisode);

// Admin routes (requires auth + admin)
router.post('/sync-mal', animeController.syncWithMAL); // Syncs anime + episodes
router.post('/sync-episodes',  animeController.syncAllEpisodes); // Episodes only
router.post('/:id/sync-episodes', animeController.syncEpisodesFromJikan); // Single anime

// This route will update existing episode synopses and titles for a given anime
router.post('/:id/sync-episode-synopsis', animeController.syncEpisodesFromJikan);
// BULK: Sync ALL anime synopses at once
router.post('/sync-all-episode-synopses',  animeController.syncAllEpisodesSynopses);


module.exports = router;
