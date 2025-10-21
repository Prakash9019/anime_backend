// backend/routes/admin.js
const express = require('express');
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// In your admin.js or a separate multer-config.js
const multer = require('multer');

// Use memoryStorage to hold the file as a buffer
const upload = multer({ storage: multer.memoryStorage() });

router.post('/anime', [auth, admin], adminController.createAnime);
router.put('/anime/:id', [auth, admin], adminController.updateAnime);
router.delete('/anime/:id', [auth, admin], adminController.deleteAnime);
router.post('/anime/:id/episodes', [auth, admin], adminController.addEpisode);
router.put('/episodes/:id', [auth, admin], adminController.updateEpisode);
router.post('/bulk-upload', [auth, admin, upload.single('file')], adminController.bulkUpload);
router.post('/employees', [auth, admin], adminController.createEmployee);
// backend/routes/admin.js
router.get('/stats',  adminController.getStats);

module.exports = router;
