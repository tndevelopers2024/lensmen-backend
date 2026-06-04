const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true },
  password: { type: String, required: true },
  mobile: String,
  address: String,
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

const formatUserResponse = (user) => ({
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile,
  address: user.address,
  role: user.role,
  kycStatus: user.kycStatus,
  kycDocuments: user.kycDocuments,
  kycRejectionReason: user.kycRejectionReason,
  customerClass: user.customerClass,
});

const User = mongoose.model('User', userSchema);

module.exports = { User, formatUserResponse };
