// backend/routes/adminAuth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    console.log(email);
    console.log(password);
    // Find admin user
    const user = await User.findOne({ 
      email: email.toLowerCase(),
    //   role: { $in: ['admin', 'superadmin'] }
    }).select('+password');
    console.log(user);
    if (!user) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid admin credentials22' });
    }

 

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { _id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      message: 'Admin login successful'
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin Register (Protected - only superadmin can create new admins)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // // Check if user making request is superadmin for creating other admins
    // const requestingUser = await User.findById(req.user._id);
    // if (role === 'superadmin' && requestingUser.role !== 'superadmin') {
    //   return res.status(403).json({ message: 'Only superadmin can create other superadmins' });
    // }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create admin user
    const newAdmin = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'admin',
      isActive: true
    });

    await newAdmin.save();

    res.status(201).json({
      message: 'Admin created successfully',
      user: {
        _id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error('Admin register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current admin profile
router.get('/me', [auth, admin], async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change admin password
router.put('/change-password', [auth, admin], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// List all admins (superadmin only)
router.get('/list', [auth, admin], async (req, res) => {
  try {
    const requestingUser = await User.findById(req.user._id);
    if (requestingUser.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can view all admins' });
    }

    const admins = await User.find({ 
      role: { $in: ['admin', 'superadmin'] } 
    }).select('-password');

    res.json({ admins });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
