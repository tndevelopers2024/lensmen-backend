const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  userName: String,
  userEmail: String,
  userAddress: String,
  userMobile: String,
  accountType: String,
  startDate: Date,
  endDate: Date,
  totalDays: Number,
  totalPrice: Number,
  status: { type: String, enum: ['Active', 'Returned'], default: 'Active' },
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
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const User = mongoose.model('User', userSchema);

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password, mobile, address, accountType } = req.body;
    const role = 'user';
    const user = new User({ fullName, email, password, mobile, address, accountType, role });
    await user.save();
    res.status(201).json({ message: 'User registered', user: { fullName, email, mobile, address, role } });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ 
      user: { 
        fullName: user.fullName, 
        email: user.email, 
        mobile: user.mobile, 
        address: user.address, 
        role: user.role 
      } 
    });
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
    const { name, description, pricePerDay } = req.body;
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const imageUrl = req.file ? `${baseUrl}/uploads/${req.file.filename}` : '';
    
    const product = new Product({
      name,
      description,
      pricePerDay,
      imageUrl
    });

    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
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
    const { name, description, pricePerDay, isAvailable } = req.body;
    let updateData = { name, description, pricePerDay, isAvailable };

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
    const bookings = await Booking.find().populate('productId').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: Update Booking Status
app.put('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = status;
    await booking.save();

    // If returned, make product available
    if (status === 'Returned') {
      await Product.findByIdAndUpdate(booking.productId, { isAvailable: true });
    } else {
      await Product.findByIdAndUpdate(booking.productId, { isAvailable: false });
    }

    res.json({ message: `Booking marked as ${status}`, status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET User Bookings
app.get('/api/user/bookings/:email', async (req, res) => {
  try {
    const bookings = await Booking.find({ userEmail: req.params.email }).populate('productId').sort({ createdAt: -1 });
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

    // Make product available again
    await Product.findByIdAndUpdate(booking.productId, { isAvailable: true });

    // Delete booking
    await Booking.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST Create Booking
app.post('/api/bookings', async (req, res) => {
  const { productId, userName, userEmail, userAddress, userMobile, accountType, startDate, endDate } = req.body;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  if (diffDays > 10) {
    return res.status(400).json({ message: 'Booking cannot exceed 10 days' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product || !product.isAvailable) {
      return res.status(400).json({ message: 'Product is not available' });
    }

    const booking = new Booking({
      productId,
      userName,
      userEmail,
      userAddress,
      userMobile,
      accountType,
      startDate,
      endDate,
      totalDays: diffDays,
      totalPrice: diffDays * product.pricePerDay
    });

    const newBooking = await booking.save();
    
    // Update product availability
    product.isAvailable = false;
    await product.save();

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
