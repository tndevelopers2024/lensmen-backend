const bcrypt = require('bcryptjs');
const { User, formatUserResponse } = require('../models/User');
const transporter = require('../config/mailer');

// ── Generate + email a 6-digit OTP, store on the user ──────────────────
const sendOtp = async (user, purpose = 'verification') => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await user.save();

  const heading = purpose === 'login' ? 'SIGN-IN VERIFICATION' : 'VERIFY YOUR ACCOUNT';
  await transporter.sendMail({
    from: `Lensmen Rentals <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `Lensmen Rentals - ${purpose === 'login' ? 'Login' : 'Verification'} Code`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #e5550f; text-align: center;">${heading}</h2>
        <p>Hello ${user.fullName || 'there'}, use the code below to continue:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 12px; text-align: center;">This code will expire in 10 minutes. If you didn't request it, please ignore this email.</p>
      </div>
    `,
  });
};

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, mobile, address, accountType } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      // Existing account — require password match, then OTP-verify before login
      let isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch && password === user.password) isMatch = true;
      if (!isMatch) return res.status(400).json({ message: 'User already exists' });

      await sendOtp(user, 'login');
      return res.json({ otpRequired: true, email: user.email, message: 'Verification code sent to your email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ fullName, email, password: hashedPassword, mobile, address, accountType, isVerified: false });
    await sendOtp(user, 'verification'); // also saves the user

    res.status(201).json({ otpRequired: true, email: user.email, message: 'Verification code sent to your email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    let isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && password === user.password) isMatch = true;
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Every login requires email OTP verification
    await sendOtp(user, 'login');
    res.json({ otpRequired: true, email: user.email, message: 'Verification code sent to your email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email, otp, otpExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isVerified = true;
    await user.save();

    res.json({ user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: `Lensmen Rentals <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Lensmen Rentals - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #e5550f; text-align: center;">PASSWORD RESET</h2>
          <p>You requested to reset your password. Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 12px; text-align: center;">This code will expire in 10 minutes.</p>
        </div>
      `,
    });

    res.json({ message: 'Password reset OTP sent', email: user.email, flow: 'forgot-password' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email, otp, otpExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
