const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();
// routes/adminAccount.js
// Get current admin info
router.get('/me', [auth, admin], async (req, res) => {
  const user = await User.findById(req.user._id).select('name email');
  res.json({ name: user.name, email: user.email });
});

// Update admin info (name/email/password)
router.put('/update', [auth, admin], async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const update = {};
  if (name) update.name = name;
  if (email) {
    const exists = await User.findOne({ email });
    if (exists && exists._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'Email already in use.' });
    }
    update.email = email;
  }
  if (newPassword) {
    const adminUser = await User.findById(req.user._id).select('+password');
    const valid = await bcrypt.compare(currentPassword, adminUser.password);
    if (!valid) return res.status(400).json({ message: 'Incorrect current password.' });
    update.password = await bcrypt.hash(newPassword, 10);
  }
  await User.findByIdAndUpdate(req.user._id, update);
  res.json({ message: 'Account updated successfully.' });
});

// Update admin email
router.put('/reset-email', [auth, admin], async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
    return res.status(400).json({ message: 'A valid new email is required.' });
  }
  try {
    // Make sure no other user already has this email
    const exists = await User.findOne({ email: newEmail });
    if (exists) {
      return res.status(400).json({ message: 'Email is already used by another account.' });
    }
    await User.findByIdAndUpdate(req.user._id, { email: newEmail });
    res.json({ message: 'Email updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update email', error: err.message });
  }
});

// Update admin password
router.put('/reset-password', [auth, admin], async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Current & new passwords (min 6 chars) are required.' });
  }
  try {
    const adminUser = await User.findById(req.user._id).select('+password');
    if (!adminUser) return res.status(404).json({ message: 'Admin not found.' });

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, adminUser.password);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    adminUser.password = newHash;
    await adminUser.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update password', error: err.message });
  }
});

module.exports = router;
