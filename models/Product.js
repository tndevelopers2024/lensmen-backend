const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:              { type: String, required: true },
  description:       { type: String, default: '' },
  pricePerDay:       { type: Number, required: true },
  imageUrl:          { type: String, default: '' },
  category:          { type: String, default: '' },
  sku:               { type: String, unique: true, sparse: true },
  totalQuantity:     { type: Number, default: 1, min: 1 },
  availableQuantity: { type: Number, default: 1, min: 0 },
  condition:         { type: String, enum: ['Excellent', 'Good', 'Fair', 'Needs Service'], default: 'Good' },
  galleryImages:     { type: [String], default: [] },
  isAvailable:       { type: Boolean, default: true },
  createdAt:         { type: Date, default: Date.now },
});

// Auto-generate SKU and sync isAvailable before save
productSchema.pre('save', async function () {
  if (!this.sku) {
    const prefix = (this.category || 'GEN').toUpperCase().slice(0, 3).replace(/\s/g, '');
    const count  = await mongoose.model('Product').countDocuments();
    this.sku     = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  this.isAvailable = this.availableQuantity > 0;
});

module.exports = mongoose.model('Product', productSchema);
