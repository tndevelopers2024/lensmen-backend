const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:        { type: String, required: true },
  pricePerDay: { type: Number, required: true },
  imageUrl:    String,
  quantity:    { type: Number, default: 1, min: 1 },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  quoteCode:          { type: String, unique: true },
  customerName:       { type: String, required: true },
  customerMobile:     String,
  customerEmail:      String,
  items:              { type: [quoteItemSchema], default: [] },
  startDate:          Date,
  endDate:            Date,
  totalDays:          { type: Number, default: 1 },
  subtotal:           { type: Number, default: 0 },
  discountAmount:     { type: Number, default: 0 },
  totalPrice:         { type: Number, default: 0 },
  notes:              String,
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Converted', 'Expired'],
    default: 'Draft',
  },
  convertedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  createdAt:          { type: Date, default: Date.now },
});

// Auto-generate quoteCode before first save
quoteSchema.pre('save', async function () {
  if (this.quoteCode) return;
  const today  = new Date();
  const yy     = String(today.getFullYear()).slice(2);
  const mm     = String(today.getMonth() + 1).padStart(2, '0');
  const dd     = String(today.getDate()).padStart(2, '0');
  const prefix = `LR-${yy}${mm}${dd}`;
  const count  = await mongoose.model('Quote').countDocuments();
  this.quoteCode = `${prefix}-${String(count + 1).padStart(3, '0')}`;
});

module.exports = mongoose.model('Quote', quoteSchema);
