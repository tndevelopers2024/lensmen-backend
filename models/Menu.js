const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  handle:   { type: String, required: true, unique: true },
  position: { type: String, enum: ['top-nav', 'sidebar', ''], default: '' },
  items:    { type: Array, default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
