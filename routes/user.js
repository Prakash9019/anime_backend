// backend/routes/user.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Rating = require('../models/Rating');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Episode = require('../models/Episode');
const Anime = require('../models/Anime');
const auth = require('../middleware/auth');
const stripe = require('../config/stripe');
const router = express.Router();

// Get user's ratings
router.get('/ratings', auth, async (req, res) => {
  try {
    const ratings = await Rating.find({ user: req.user._id })
      .populate({
        path: 'anime',
        select: 'title poster'
      })
      .populate({
        path: 'episode',
        select: 'title number anime',
        populate: {
          path: 'anime',
          model: 'Anime',
          select: 'title poster'
        }
      })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to recent 50 ratings
    
    // Transform ratings to include both anime and episode ratings
    const transformedRatings = ratings.map(rating => ({
      _id: rating._id,
      rating: rating.rating,
      createdAt: rating.createdAt,
      anime: rating.anime,
      episode: rating.episode
    }));
    res.json({ ratings: transformedRatings });
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user profile with stats
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user statistics
    const ratingsCount = await Rating.countDocuments({ user: req.user._id });
    const animeRatingsCount = await Rating.countDocuments({ 
      user: req.user._id, 
      anime: { $exists: true } 
    });
    const episodeRatingsCount = await Rating.countDocuments({ 
      user: req.user._id, 
      episode: { $exists: true } 
    });
    
    // Get donation history
    const donations = await Donation.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const totalDonated = donations.reduce((sum, donation) => 
      donation.status === 'completed' ? sum + donation.amount : sum, 0
    );

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdFree: user.isAdFree || false,
        adFreeGrantedAt: user.adFreeGrantedAt,
        createdAt: user.createdAt
      },
      stats: {
        totalRatings: ratingsCount,
        animeRatings: animeRatingsCount,
        episodeRatings: episodeRatingsCount,
        totalDonated: totalDonated,
        donationCount: donations.filter(d => d.status === 'completed').length
      },
      donations: donations
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Check ad-free status
router.get('/ad-free-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('isAdFree adFreeGrantedAt');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      isAdFree: user.isAdFree || false,
      adFreeGrantedAt: user.adFreeGrantedAt
    });
  } catch (error) {
    console.error('Check ad-free status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updateData = {};
    
    if (name && name.trim()) {
      updateData.name = name.trim();
    }
    
    if (avatar) {
      updateData.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdFree: user.isAdFree
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findByIdAndUpdate(req.user._id, { password: hashedNewPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's watchlist/favorites
router.get('/watchlist', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'watchlist',
        select: 'title poster averageRating genres status',
        options: { limit: 50 }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ watchlist: user.watchlist || [] });
  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add anime to watchlist
router.post('/watchlist/:animeId', auth, async (req, res) => {
  try {
    const { animeId } = req.params;

    // Check if anime exists
    const anime = await Anime.findById(animeId);
    if (!anime) {
      return res.status(404).json({ message: 'Anime not found' });
    }

    // Add to user's watchlist if not already present
    const user = await User.findById(req.user._id);
    if (!user.watchlist) {
      user.watchlist = [];
    }

    if (!user.watchlist.includes(animeId)) {
      user.watchlist.push(animeId);
      await user.save();
    }

    res.json({ message: 'Added to watchlist successfully' });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove anime from watchlist
router.delete('/watchlist/:animeId', auth, async (req, res) => {
  try {
    const { animeId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user.watchlist) {
      return res.status(404).json({ message: 'Watchlist is empty' });
    }

    user.watchlist = user.watchlist.filter(id => id.toString() !== animeId);
    await user.save();

    res.json({ message: 'Removed from watchlist successfully' });
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's donation history
router.get('/donations', auth, async (req, res) => {
  try {
    const donations = await Donation.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    const totalDonated = donations.reduce((sum, donation) => 
      donation.status === 'completed' ? sum + donation.amount : sum, 0
    );

    res.json({ 
      donations,
      totalDonated,
      donationCount: donations.filter(d => d.status === 'completed').length
    });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user activity (recent ratings, watchlist changes, etc.)
router.get('/activity', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Get recent ratings
    const recentRatings = await Rating.find({ user: req.user._id })
      .populate('anime', 'title poster')
      .populate('episode', 'title number')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Get recent donations
    const recentDonations = await Donation.find({ 
      user: req.user._id,
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .limit(5);

    // Combine and sort activities by date
    const activities = [
      ...recentRatings.map(rating => ({
        type: 'rating',
        action: rating.episode ? 'Rated episode' : 'Rated anime',
        target: rating.episode ? 
          `${rating.anime?.title} - Episode ${rating.episode?.number}` : 
          rating.anime?.title,
        rating: rating.rating,
        date: rating.createdAt
      })),
      ...recentDonations.map(donation => ({
        type: 'donation',
        action: 'Made donation',
        target: `$${donation.amount}`,
        date: donation.createdAt
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);

    res.json({ activities });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user account
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete account' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Delete user's data
    await Rating.deleteMany({ user: req.user._id });
    await Donation.updateMany(
      { user: req.user._id },
      { $unset: { user: 1 } } // Remove user reference but keep donation record
    );

    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences');
    
    const defaultPreferences = {
      notifications: {
        email: true,
        push: true,
        newEpisodes: true,
        recommendations: true
      },
      privacy: {
        showRatings: true,
        showWatchlist: true,
        showActivity: false
      },
      display: {
        theme: 'dark',
        language: 'en',
        adultContent: false
      }
    };

    res.json({ 
      preferences: user?.preferences || defaultPreferences 
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const { preferences } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences },
      { new: true, runValidators: true }
    ).select('preferences');

    res.json({ 
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});














// Mock payment processing function (replace with actual payment gateway)
async function processPayment(paymentData) {
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock success/failure logic
  const success = Math.random() > 0.1; // 90% success rate for demo

  if (success) {
    return {
      success: true,
      paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  } else {
    return {
      success: false,
      error: 'Payment declined by bank',
    };
  }
}

// backend/routes/user.js
router.post('/donate_test', auth, async (req, res) => {
  try {
    const { amount, paymentMethod, cardNumber, expiryDate, cvv, cardName, upiId } = req.body;

    // Validation
    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid donation amount' });
    }

    if (!paymentMethod || !['card', 'upi'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Validate payment details based on method
    if (paymentMethod === 'card') {
      if (!cardNumber || !expiryDate || !cvv || !cardName) {
        return res.status(400).json({ message: 'All card details are required' });
      }
      
      // Basic card validation
      if (cardNumber.length < 16) {
        return res.status(400).json({ message: 'Invalid card number' });
      }
    }

    if (paymentMethod === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        return res.status(400).json({ message: 'Invalid UPI ID' });
      }
    }

    // Simulate payment processing (replace with actual payment gateway integration)
    const paymentResult = await processPayment({
      amount,
      paymentMethod,
      cardNumber: paymentMethod === 'card' ? cardNumber.slice(-4) : null, // Only store last 4 digits
      upiId: paymentMethod === 'upi' ? upiId : null,
    });

    if (!paymentResult.success) {
      return res.status(400).json({ message: paymentResult.error || 'Payment failed' });
    }

    // Create donation record
    const donation = new Donation({
      user: req.user._id,
      amount,
      paymentMethod,
      paymentId: paymentResult.paymentId,
      status: 'completed',
      createdAt: new Date(),
    });

    await donation.save();

    // Grant ad-free access
    await User.findByIdAndUpdate(req.user._id, {
      isAdFree: true,
      adFreeGrantedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Donation successful! Thank you for supporting Anime Flow.',
      donation: {
        id: donation._id,
        amount: donation.amount,
        paymentMethod: donation.paymentMethod,
        createdAt: donation.createdAt,
      },
    });
  } catch (error) {
    console.error('Donation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/donate', auth, async (req, res) => {
  try {
    const { amount, paymentMethod, cardNumber, expiryDate, cvv, cardName, upiId } = req.body;
    // validation omitted for brevity

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // in paise
      currency: 'inr',
      payment_method_types: paymentMethod === 'card' ? ['card'] : ['upi'],
      metadata: { userId: req.user._id.toString() }
    });

    // Return client secret to frontend
    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ message: 'Payment initialization failed' });
  }
});

module.exports = router;
