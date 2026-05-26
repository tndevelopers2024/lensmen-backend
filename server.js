const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folder for images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Schemas
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  pricePerDay: Number,
  imageUrl: String,
  isAvailable: { type: Boolean, default: true },
  category: String
});

const bookingSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // Legacy single product
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    pricePerDay: Number,
    imageUrl: String
  }],
  userName: String,
  userEmail: String,
  userAddress: String,
  userMobile: String,
  accountType: String,
  startDate: Date,
  endDate: Date,
  totalDays: Number,
  totalPrice: Number,
  status: { 
    type: String, 
    enum: [
      'Request Submitted', 'KYC Pending', 'KYC Approved', 'Approved', 
      'Ready for Pickup', 'Picked Up', 'During Rental', 'Return Pending', 
      'Returned', 'Closed', 'Rejected', 'Active'
    ], 
    default: 'Request Submitted' 
  },
  rejectionReason: String,
  returnCondition: { type: String, enum: ['Good', 'Bad'], default: 'Good' },
  returnNotes: String,
  createdAt: { type: Date, default: Date.now }
});

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
    panBack: String
  },
  kycRejectionReason: String,
  customerClass: { type: String, enum: ['New', 'Regular', 'Frequent', 'VIP', 'Celebrity', 'Corporate'], default: 'New' },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const User = mongoose.model('User', userSchema);

// Auth Routes
const formatUserResponse = (user) => ({
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile,
  address: user.address,
  role: user.role,
  kycStatus: user.kycStatus,
  kycDocuments: user.kycDocuments,
  kycRejectionReason: user.kycRejectionReason,
  customerClass: user.customerClass
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password, mobile, address, accountType } = req.body;
    
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      // If user exists, check if password matches to allow seamless login
      let isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch && password === user.password) isMatch = true; // Fallback for legacy plain text

      if (isMatch) {
        return res.json({ 
          message: 'Existing user logged in.',
          user: formatUserResponse(user)
        });
      }
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user (Auto-verified for now)
    user = new User({ 
      fullName, email, password: hashedPassword, 
      mobile, address, accountType, 
      isVerified: true 
    });

    await user.save();

    res.status(201).json({ 
      message: 'Registration successful',
      user: formatUserResponse(user)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Check password (with plain-text fallback for all legacy accounts)
    let isMatch = await bcrypt.compare(password, user.password);
    
    // Fallback for plain text
    if (!isMatch && password === user.password) {
      isMatch = true;
    }

    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({ 
      user: formatUserResponse(user)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ 
      email, 
      otp, 
      otpExpiry: { $gt: new Date() } 
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    // Clear OTP after successful verification and mark as verified
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isVerified = true;
    await user.save();

    res.json({ 
      user: formatUserResponse(user)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
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
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Password reset OTP sent', email: user.email, flow: 'forgot-password' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ 
      email, 
      otp, 
      otpExpiry: { $gt: new Date() } 
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Routes
app.get('/', (req, res) => {
  res.send('Rental App API is running...');
});

// GET Available Products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ isAvailable: true });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST New Product (Admin) with Multer Upload
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { name, description, pricePerDay, category } = req.body;
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const imageUrl = req.file ? `${baseUrl}/uploads/${req.file.filename}` : '';
    
    const product = new Product({
      name,
      description,
      pricePerDay,
      imageUrl,
      category
    });

    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET All Unique Categories
app.get('/api/products/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { category: { $ne: null, $ne: '' } });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: Get All Products
app.get('/api/admin/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE Product (Admin)
app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE Product (Admin) with optional image upload
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, description, pricePerDay, isAvailable, category } = req.body;
    let updateData = { name, description, pricePerDay, isAvailable, category };

    if (req.file) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
      updateData.imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ADMIN: Get Dashboard Stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const productCount = await Product.countDocuments();
    const bookingCount = await Booking.countDocuments();
    const bookings = await Booking.find();
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    
    res.json({
      productCount,
      bookingCount,
      totalRevenue
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: Get All Bookings
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().populate('productId').populate('items.productId').sort({ createdAt: -1 }).lean();
    const bookingsWithUserKyc = await Promise.all(bookings.map(async (booking) => {
      const user = await User.findOne({ email: booking.userEmail }).select('-password').lean();
      return {
        ...booking,
        userKyc: user || null
      };
    }));
    res.json(bookingsWithUserKyc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: Get All Users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: Update Booking Status
app.put('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { status, returnCondition, returnNotes, rejectionReason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = status;
    if (returnCondition) booking.returnCondition = returnCondition;
    if (returnNotes !== undefined) booking.returnNotes = returnNotes;
    if (rejectionReason !== undefined) booking.rejectionReason = rejectionReason;
    await booking.save();

    // If status is Returned, Closed, or Rejected, release products back into inventory
    const isReleased = ['Returned', 'Closed', 'Rejected'].includes(status);
    const isAvailable = isReleased;
    
    // Update main productId (legacy)
    if (booking.productId) {
      await Product.findByIdAndUpdate(booking.productId, { isAvailable });
    }
    
    // Update all products in items
    if (booking.items && booking.items.length > 0) {
      for (const item of booking.items) {
        await Product.findByIdAndUpdate(item.productId, { isAvailable });
      }
    }

    res.json({ message: `Booking marked as ${status}`, status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST User KYC Upload
app.post('/api/user/kyc', upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panFront', maxCount: 1 },
  { name: 'panBack', maxCount: 1 }
]), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const files = req.files || {};
    const kycDocuments = { ...user.kycDocuments };

    if (files.aadhaarFront && files.aadhaarFront[0]) {
      kycDocuments.aadhaarFront = `${baseUrl}/uploads/${files.aadhaarFront[0].filename}`;
    }
    if (files.aadhaarBack && files.aadhaarBack[0]) {
      kycDocuments.aadhaarBack = `${baseUrl}/uploads/${files.aadhaarBack[0].filename}`;
    }
    if (files.panFront && files.panFront[0]) {
      kycDocuments.panFront = `${baseUrl}/uploads/${files.panFront[0].filename}`;
    }
    if (files.panBack && files.panBack[0]) {
      kycDocuments.panBack = `${baseUrl}/uploads/${files.panBack[0].filename}`;
    }

    user.kycDocuments = kycDocuments;
    user.kycStatus = 'Pending';
    user.kycRejectionReason = undefined; // Clear previous rejection reason
    await user.save();

    res.json(formatUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: Verify User KYC
app.put('/api/admin/users/:id/kyc', async (req, res) => {
  try {
    const { kycStatus, kycRejectionReason } = req.body;
    if (!['Approved', 'Rejected'].includes(kycStatus)) {
      return res.status(400).json({ message: 'Invalid KYC status' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.kycStatus = kycStatus;
    if (kycStatus === 'Rejected') {
      user.kycRejectionReason = kycRejectionReason || 'Documents rejected by admin';
    } else {
      user.kycRejectionReason = undefined;
    }

    await user.save();
    res.json({ message: `KYC status updated to ${kycStatus}`, user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: Update User Classification
app.put('/api/admin/users/:id/class', async (req, res) => {
  try {
    const { customerClass } = req.body;
    if (!['New', 'Regular', 'Frequent', 'VIP', 'Celebrity', 'Corporate'].includes(customerClass)) {
      return res.status(400).json({ message: 'Invalid customer class' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.customerClass = customerClass;
    await user.save();

    res.json({ message: `Customer class updated to ${customerClass}`, user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE User Profile
app.put('/api/user/profile', async (req, res) => {
  try {
    const { email, fullName, mobile, address } = req.body;
    const user = await User.findOneAndUpdate(
      { email },
      { fullName, mobile, address },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(formatUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET User Bookings
app.get('/api/user/bookings/:email', async (req, res) => {
  try {
    const bookings = await Booking.find({ userEmail: req.params.email }).populate('productId').populate('items.productId').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE Cancel Booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Make products available again
    if (booking.productId) {
      await Product.findByIdAndUpdate(booking.productId, { isAvailable: true });
    }
    
    if (booking.items && booking.items.length > 0) {
      for (const item of booking.items) {
        await Product.findByIdAndUpdate(item.productId, { isAvailable: true });
      }
    }

    // Delete booking
    await Booking.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST Create Booking
app.post('/api/bookings', async (req, res) => {
  const { productId, products, userName, userEmail, userAddress, userMobile, accountType, startDate, endDate } = req.body;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  if (diffDays > 10) {
    return res.status(400).json({ message: 'Booking cannot exceed 10 days' });
  }

  try {
    let bookingItems = [];
    let totalPrice = 0;

    if (products && Array.isArray(products)) {
      // Handle multiple products
      for (const p of products) {
        const product = await Product.findById(p._id);
        if (!product || !product.isAvailable) {
          return res.status(400).json({ message: `Product ${product?.name || p._id} is not available` });
        }
        bookingItems.push({
          productId: product._id,
          name: product.name,
          pricePerDay: product.pricePerDay,
          imageUrl: product.imageUrl
        });
        totalPrice += diffDays * product.pricePerDay;
      }
    } else if (productId) {
      // Handle legacy single product
      const product = await Product.findById(productId);
      if (!product || !product.isAvailable) {
        return res.status(400).json({ message: 'Product is not available' });
      }
      bookingItems.push({
        productId: product._id,
        name: product.name,
        pricePerDay: product.pricePerDay,
        imageUrl: product.imageUrl
      });
      totalPrice = diffDays * product.pricePerDay;
    } else {
      return res.status(400).json({ message: 'No products selected' });
    }

    let initialStatus = 'Request Submitted';
    const userDoc = await User.findOne({ email: userEmail });
    if (userDoc) {
      if (userDoc.kycStatus === 'Approved') {
        initialStatus = 'KYC Approved';
      } else {
        initialStatus = 'KYC Pending';
      }
    }

    const booking = new Booking({
      productId: bookingItems[0].productId, // First item for compatibility
      items: bookingItems,
      userName,
      userEmail,
      userAddress,
      userMobile,
      accountType,
      startDate,
      endDate,
      totalDays: diffDays,
      totalPrice,
      status: initialStatus
    });

    const newBooking = await booking.save();
    
    // Update product availability for all items
    for (const item of bookingItems) {
      await Product.findByIdAndUpdate(item.productId, { isAvailable: false });
    }

    res.status(201).json(newBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
