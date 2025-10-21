// backend/routes/ads.js
const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const Ad = require('../models/Ad');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'anime-flow/ads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 450, crop: 'limit' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      return `ad-${timestamp}-${randomString}`;
    }
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
});

// Create new ad
router.post('/', [auth, admin, upload.single('bannerImage')], async (req, res) => {
  try {
    const {
      title,
      description,
      ctaText,
      targetUrl,
      targetUsers,
      priority,
      budget,
      costPerView,
      adType,
      startDate,
      endDate,
      targeting
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Banner image is required' });
    }

    // Cloudinary automatically uploads and provides URL
    const bannerImage = req.file.path; // Cloudinary URL
    const cloudinaryPublicId = req.file.filename; // Cloudinary public ID

    const ad = new Ad({
      title,
      description,
      bannerImage,
      cloudinaryPublicId,
      ctaText: ctaText || 'Learn More',
      targetUrl,
      targetUsers: parseInt(targetUsers),
      priority: priority ? parseInt(priority) : 1,
      budget: budget ? parseFloat(budget) : 0,
      costPerView: costPerView ? parseFloat(costPerView) : 0,
      adType: adType || 'banner',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.user._id,
      targeting: targeting ? JSON.parse(targeting) : {}
    });

    await ad.save();
    
    res.status(201).json({
      message: 'Ad created successfully',
      ad: await ad.populate('createdBy', 'name email')
    });
  } catch (error) {
    console.error('Create ad error:', error);
    res.status(500).json({ message: 'Error creating ad', error: error.message });
  }
});

// Get all ads (admin)
router.get('/admin', [auth, admin], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status; // 'active', 'inactive', 'all'

    let query = {};
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const ads = await Ad.find(query)
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Ad.countDocuments(query);
    const activeCount = await Ad.countDocuments({ isActive: true });
    const inactiveCount = await Ad.countDocuments({ isActive: false });

    res.json({
      ads,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      },
      stats: {
        total,
        active: activeCount,
        inactive: inactiveCount
      }
    });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({ message: 'Error fetching ads', error: error.message });
  }
});

// Get active ads for users (with rotation logic)
router.get('/active', async (req, res) => {
  try {
    const currentDate = new Date();
    
    const ads = await Ad.find({
      isActive: true,
      $or: [
        { endDate: null },
        { endDate: { $gte: currentDate } }
      ],
      startDate: { $lte: currentDate },
      $expr: { $lt: ['$currentViews', '$targetUsers'] }
    })
    .sort({ priority: -1, createdAt: -1 })
    .limit(20);

    // Weighted selection based on priority and remaining views
    const weightedAds = ads.map(ad => {
      const remainingViews = ad.targetUsers - ad.currentViews;
      const weight = ad.priority * Math.max(remainingViews / ad.targetUsers, 0.1);
      return { ...ad.toObject(), weight };
    });

    // Sort by weight for better ad distribution
    weightedAds.sort((a, b) => b.weight - a.weight);

    res.json({ ads: weightedAds.slice(0, 10) });
  } catch (error) {
    console.error('Get active ads error:', error);
    res.status(500).json({ message: 'Error fetching active ads', error: error.message });
  }
});

// Update ad
router.put('/:id', [auth, admin, upload.single('bannerImage')], async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    const updateData = { ...req.body };

    // If new image is uploaded, delete old one from Cloudinary and update
    if (req.file) {
      // Delete old image from Cloudinary
      if (ad.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(ad.cloudinaryPublicId);
        } catch (cloudinaryError) {
          console.error('Error deleting old image from Cloudinary:', cloudinaryError);
        }
      }

      updateData.bannerImage = req.file.path;
      updateData.cloudinaryPublicId = req.file.filename;
    }

    const updatedAd = await Ad.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.json({ message: 'Ad updated successfully', ad: updatedAd });
  } catch (error) {
    console.error('Update ad error:', error);
    res.status(500).json({ message: 'Error updating ad', error: error.message });
  }
});

// Delete ad
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    // Delete image from Cloudinary
    if (ad.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(ad.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Error deleting image from Cloudinary:', cloudinaryError);
      }
    }

    await Ad.findByIdAndDelete(req.params.id);

    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({ message: 'Error deleting ad', error: error.message });
  }
});

// Track ad view
router.post('/:id/view', async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(
      req.params.id,
      { $inc: { currentViews: 1 } },
      { new: true }
    );

    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    res.json({ message: 'View tracked', viewsRemaining: ad.targetUsers - ad.currentViews });
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({ message: 'Error tracking view', error: error.message });
  }
});

// Track ad click
router.post('/:id/click', async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(
      req.params.id,
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    res.json({ 
      message: 'Click tracked', 
      targetUrl: ad.targetUrl,
      ctr: ad.currentViews > 0 ? (ad.clicks / ad.currentViews * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ message: 'Error tracking click', error: error.message });
  }
});

// Get ad analytics
router.get('/:id/analytics', [auth, admin], async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id).populate('createdBy', 'name email');
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    const analytics = {
      ad,
      performance: {
        impressions: ad.currentViews,
        clicks: ad.clicks,
        ctr: ad.currentViews > 0 ? (ad.clicks / ad.currentViews * 100).toFixed(2) : 0,
        remainingViews: ad.targetUsers - ad.currentViews,
        completionRate: ((ad.currentViews / ad.targetUsers) * 100).toFixed(2),
        costPerClick: ad.clicks > 0 ? (ad.budget / ad.clicks).toFixed(2) : 0
      },
      status: {
        isActive: ad.isActive,
        isExpired: ad.endDate && ad.endDate < new Date(),
        isCompleted: ad.currentViews >= ad.targetUsers
      }
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
});

// Bulk operations
router.post('/bulk-action', [auth, admin], async (req, res) => {
  try {
    const { action, adIds } = req.body;

    if (!adIds || !Array.isArray(adIds) || adIds.length === 0) {
      return res.status(400).json({ message: 'Ad IDs are required' });
    }

    let result;
    switch (action) {
      case 'activate':
        result = await Ad.updateMany(
          { _id: { $in: adIds } },
          { isActive: true }
        );
        break;
      case 'deactivate':
        result = await Ad.updateMany(
          { _id: { $in: adIds } },
          { isActive: false }
        );
        break;
      case 'delete':
        // Delete images from Cloudinary first
        const adsToDelete = await Ad.find({ _id: { $in: adIds } });
        for (const ad of adsToDelete) {
          if (ad.cloudinaryPublicId) {
            try {
              await cloudinary.uploader.destroy(ad.cloudinaryPublicId);
            } catch (error) {
              console.error('Error deleting image:', error);
            }
          }
        }
        result = await Ad.deleteMany({ _id: { $in: adIds } });
        break;
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    res.json({ 
      message: `Bulk ${action} completed`, 
      affected: result.modifiedCount || result.deletedCount 
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ message: 'Error performing bulk action', error: error.message });
  }
});

module.exports = router;
