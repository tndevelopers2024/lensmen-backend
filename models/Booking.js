const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  type:          { type: String, enum: ['advance', 'final'], required: true },
  amount:        { type: Number, required: true },
  mode:          { type: String, enum: ['UPI', 'Cash', 'Bank Transfer', 'Card', 'Others'], required: true },
  transactionId: { type: String, default: '' },
  notes:         { type: String, default: '' },
  collectedAt:   { type: Date, default: Date.now },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  bookingCode: { type: String, unique: true, sparse: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity:  { type: Number, default: 1, min: 1 },
  items: [{
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:        String,
    pricePerDay: Number,
    imageUrl:    String,
    quantity:    { type: Number, default: 1 },
  }],
  userName:    String,
  userEmail:   String,
  userAddress: String,
  userMobile:  String,
  accountType: String,
  startDate:   Date,
  endDate:     Date,
  totalDays:   Number,
  totalPrice:  Number,
  status: {
    type: String,
    enum: [
      'Request Submitted', 'KYC Pending', 'KYC Approved', 'Approved',
      'Ready for Pickup', 'Picked Up', 'During Rental', 'Return Pending',
      'Returned', 'Closed', 'Reopened', 'Rejected', 'Active',
    ],
    default: 'Request Submitted',
  },
  offerCode:       { type: String, default: null },
  discountAmount:  { type: Number, default: 0 },
  originalPrice:   { type: Number, default: 0 },
  notes:           String,
  rejectionReason: String,
  reopenNotes:     String,
  pickupLocation:  { type: String, default: '' },
  returnCondition: { type: String, enum: ['Good', 'Bad'], default: 'Good' },
  returnNotes:     String,
  // ── Payment fields ────────────────────────────────────────────────
  payments:        { type: [paymentSchema], default: [] },
  paymentStatus:   { type: String, enum: ['Unpaid', 'Advance Paid', 'Fully Paid'], default: 'Unpaid' },
  totalPaid:       { type: Number, default: 0 },
  pendingAmount:   { type: Number, default: 0 },
  createdAt:       { type: Date, default: Date.now },
});

bookingSchema.pre('save', async function () {
  if (this.bookingCode) return;
  const count = await mongoose.model('Booking').countDocuments();
  this.bookingCode = `LR-INV-${String(count + 1).padStart(3, '0')}`;
});

module.exports = mongoose.model('Booking', bookingSchema);
