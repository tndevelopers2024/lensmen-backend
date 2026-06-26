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
    unitId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ProductUnit', default: null },
    unitCode: { type: String, default: '' },
    vendorId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    vendorName:          { type: String, default: '' },
    vendorCost:          { type: Number, default: 0 },
    vendorPaymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    vendorPaidDate:      { type: Date, default: null },
    vendorPaidAmount:    { type: Number, default: 0 },
  }],
  userName:        String,
  userEmail:       String,
  userAddress:     String,
  userMobile:      String,
  userGstNumber:   String,
  userGstBusinessName: String,
  accountType:     String,
  startDate:   Date,
  endDate:     Date,
  totalDays:   Number,
  totalPrice:  Number,
  status: {
    type: String,
    enum: [
      'Request Submitted', 'KYC Pending', 'KYC Approved', 'Approved',
      'Ready for Pickup', 'Picked Up', 'During Rental', 'Return Pending',
      'Returned', 'Closed', 'Reopened', 'Rejected', 'Active', 'Cancelled',
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
  isArchived:      { type: Boolean, default: false },
  archivedAt:      { type: Date, default: null },
  isEarlyReturn:      { type: Boolean, default: false },
  actualReturnDate:   { type: Date, default: null },
  actualDays:         { type: Number, default: null },
  earlyReturnRefund:    { type: Number, default: 0 },
  cancellationReason:   { type: String, default: '' },
});

bookingSchema.pre('save', async function () {
  if (this.bookingCode) return;
  // Use max existing number instead of count so deletions don't cause collisions
  const existing = await mongoose.model('Booking')
    .find({ bookingCode: { $exists: true, $ne: null } })
    .select('bookingCode -_id')
    .lean();
  const maxNum = existing.reduce((max, b) => {
    const match = (b.bookingCode || '').match(/(\d+)$/);
    const n = match ? parseInt(match[1], 10) : 0;
    return n > max ? n : max;
  }, 0);
  this.bookingCode = `LR-INV-${String(maxNum + 1).padStart(3, '0')}`;
});

module.exports = mongoose.model('Booking', bookingSchema);
