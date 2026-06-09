const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  code:           { type: String, required: true, unique: true, uppercase: true, trim: true },
  description:    { type: String, required: true },
  discountType:   { type: String, enum: ['percentage', 'flat'], required: true },
  discountValue:  { type: Number, required: true, min: 0 },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscount:    { type: Number, default: 0 }, // 0 = no cap (percentage only)
  expiryDate:     { type: Date, default: null },
  isActive:       { type: Boolean, default: true },
  usageLimit:     { type: Number, default: 0 },  // 0 = unlimited
  usedCount:      { type: Number, default: 0 },
  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('Offer', offerSchema);
