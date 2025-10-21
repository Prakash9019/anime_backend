// backend/middleware/admin.js
module.exports = (req, res, next) => {
  console.log('Admin middleware triggered');
  console.log('User:', req.user);
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};
