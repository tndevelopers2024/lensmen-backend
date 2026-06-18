const { User, formatUserResponse } = require('../models/User');
const socket = require('../config/socket');
const { sendWhatsApp } = require('../config/whatsapp');

exports.getMe = async (req, res) => {
  try {
    const { email } = req.query
    if (!email) return res.status(400).json({ message: 'Email required' })
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(formatUserResponse(user))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.updateProfile = async (req, res) => {
  try {
    const { email, fullName, mobile, address } = req.body;
    const user = await User.findOneAndUpdate({ email }, { fullName, mobile, address }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(formatUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.uploadKyc = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5014}`;
    const files = req.files || {};
    const kycDocuments = { ...user.kycDocuments };

    if (files.aadhaarFront?.[0]) kycDocuments.aadhaarFront = `${baseUrl}/uploads/${files.aadhaarFront[0].filename}`;
    if (files.aadhaarBack?.[0])  kycDocuments.aadhaarBack  = `${baseUrl}/uploads/${files.aadhaarBack[0].filename}`;
    if (files.panFront?.[0])     kycDocuments.panFront     = `${baseUrl}/uploads/${files.panFront[0].filename}`;
    if (files.panBack?.[0])      kycDocuments.panBack      = `${baseUrl}/uploads/${files.panBack[0].filename}`;

    user.kycDocuments = kycDocuments;
    user.kycStatus = 'Pending';
    user.kycRejectionReason = undefined;
    await user.save();

    if (user.mobile) {
      sendWhatsApp(user.mobile, 'lr_kyc_submitted', [user.fullName || user.email]).catch(() => {})
    }

    res.json(formatUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.kycReminder = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    socket.notify({
      recipient: 'admin',
      type: 'kyc_reminder',
      title: 'KYC Review Requested',
      message: `${user.fullName} (${email}) is requesting KYC verification review`,
    });

    res.json({ message: 'Reminder sent to admin' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
