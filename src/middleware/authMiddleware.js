const jwt = require('jsonwebtoken');

const User = require('../models/User');

exports.verifyToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'Token tidak ditemukan' });

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid' });
  }
};

exports.isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Akses ditolak. Memerlukan hak akses admin.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
