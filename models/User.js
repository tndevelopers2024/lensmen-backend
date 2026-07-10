const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, sparse: true },
  fullName: String,
  email: { type: String, unique: true },
  password: { type: String, default: '' },
  adminCreated: { type: Boolean, default: false },
  mobile: String,
  secondMobile: String,
  companyName: String,
  address: String,
  gstNumber: String,
  gstBusinessName: String,
  accountType: { type: String, enum: ['Private', 'Company'], default: 'Private' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  otp: String,
  otpExpiry: Date,
  isVerified: { type: Boolean, default: false },
  kycStatus: { type: String, enum: ['Not Uploaded', 'Pending', 'Approved', 'Rejected'], default: 'Not Uploaded' },
  kycDocuments: {
    aadhaarFront: String,
    aadhaarBack: String,
    panFront: String,
    panBack: String,
  },
  kycRejectionReason: String,
  customerClass: { type: String, enum: ['New', 'Regular', 'Frequent', 'VIP', 'Celebrity', 'Corporate'], default: 'New' },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function () {
  if (this.userId) return;
  const lastDoc = await mongoose.model('User').findOne().sort({ _id: -1 });
  let count = 0;
  if (lastDoc && lastDoc.userId) {
    const parts = lastDoc.userId.split('-');
    count = parseInt(parts[parts.length - 1], 10) || 0;
  }
  this.userId = `LR-USR-${String(count + 1).padStart(3, '0')}`;
});

const formatUserResponse = (user) => ({
  userId: user.userId,
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile,
  secondMobile: user.secondMobile,
  companyName: user.companyName,
  address: user.address,
  gstNumber: user.gstNumber,
  gstBusinessName: user.gstBusinessName,
  accountType: user.accountType,
  role: user.role,
  kycStatus: user.kycStatus,
  kycDocuments: user.kycDocuments,
  kycRejectionReason: user.kycRejectionReason,
  customerClass: user.customerClass,
});

const User = mongoose.model('User', userSchema);

module.exports = { User, formatUserResponse };
