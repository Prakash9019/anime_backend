// backend/models/Ad.js (Add cloudinaryPublicId field)
const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  bannerImage: { type: String, required: true }, // Cloudinary URL
  cloudinaryPublicId: { type: String }, // For deletion
  ctaText: { type: String, default: 'Learn More' },
  targetUrl: { type: String },
  targetUsers: { 
    type: Number, 
    required: true,
    min: 1
  },
  currentViews: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  priority: { type: Number, default: 1, min: 1, max: 10 },
  budget: { type: Number, default: 0 },
  costPerView: { type: Number, default: 0 },
  adType: { 
    type: String, 
    enum: ['banner', 'interstitial', 'native'], 
    default: 'banner' 
  },
  targeting: {
    countries: [String],
    ageRange: {
      min: { type: Number, min: 13 },
      max: { type: Number, max: 100 }
    },
    interests: [String]
  }
}, { timestamps: true });

// Index for efficient queries
adSchema.index({ isActive: 1, priority: -1, createdAt: -1 });
adSchema.index({ targetUsers: 1, currentViews: 1 });

module.exports = mongoose.model('Ad', adSchema);
