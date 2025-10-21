// backend/routes/admin.js
const express = require('express');
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const multer = require('multer');

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

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
