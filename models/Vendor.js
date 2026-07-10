const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const vendorSchema = new mongoose.Schema({
  vendorNumber:     { type: String, unique: true, sparse: true },
  name:             { type: String, required: true },
  companyName:      String,
  email:            String,
  phone:            String,
  billingAddress:   String,
  shippingAddress:  String,
  address:          String,
  gstNumber:        String,
  notes:            String,
  isActive:         { type: Boolean, default: true },
  comments:         { type: [commentSchema], default: [] },
}, { timestamps: true });

vendorSchema.pre('save', async function () {
  if (this.vendorNumber) return;
  const lastDoc = await mongoose.model('Vendor').findOne().sort({ _id: -1 });
  let count = 0;
  if (lastDoc && lastDoc.vendorNumber) {
    const parts = lastDoc.vendorNumber.split('-');
    count = parseInt(parts[parts.length - 1], 10) || 0;
  }
  this.vendorNumber = `LR-VEN-${String(count + 1).padStart(3, '0')}`;
});

module.exports = mongoose.model('Vendor', vendorSchema);
