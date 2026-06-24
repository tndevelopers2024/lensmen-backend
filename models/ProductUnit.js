const mongoose = require('mongoose');

const productUnitSchema = new mongoose.Schema({
  productId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  unitCode:         { type: String, unique: true },           // e.g. CAM-0069-U01
  serialNumber:     { type: String, default: '' },            // physical serial / asset tag
  status:           { type: String, enum: ['available', 'rented', 'maintenance', 'damaged'], default: 'available' },
  condition:        { type: String, enum: ['Excellent', 'Good', 'Fair', 'Needs Service'], default: 'Good' },
  currentBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  notes:            { type: String, default: '' },
}, { timestamps: true });

// Auto-generate unitCode based on parent product's SKU
productUnitSchema.pre('save', async function () {
  if (this.unitCode) return;
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.productId).select('sku').lean();
  const prefix  = product?.sku || 'UNK';
  const count   = await mongoose.model('ProductUnit').countDocuments({ productId: this.productId });
  this.unitCode = `${prefix}-U${String(count + 1).padStart(2, '0')}`;
});

module.exports = mongoose.model('ProductUnit', productUnitSchema);
