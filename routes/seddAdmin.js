// backend/scripts/seedAdmins.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const seedAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const admins = [
      {
        name: 'The Anime Flow Admin',
        email: 'theanimeflow@gmail.com',
        password: 'admin123456',
        role: 'superadmin'
      },
      {
        name: 'Anime Flow Admin',
        email: 'admin@animeflow.com',
        password: 'AnimeFlow@2025',
        role: 'admin'
      }
    ];

    for (const admin of admins) {
      // Check if admin already exists
      const existingAdmin = await User.findOne({ email: admin.email });
      
      if (existingAdmin) {
        console.log(`Admin ${admin.email} already exists`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(admin.password, 10);

      // Create admin
      const newAdmin = new User({
        name: admin.name,
        email: admin.email,
        password: hashedPassword,
        role: admin.role,
        isActive: true
      });

      await newAdmin.save();
      console.log(`✅ Created admin: ${admin.email}`);
    }

    console.log('Admin seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admins:', error);
    process.exit(1);
  }
};

seedAdmins();
