require('dotenv').config();
const express = require('express');
const http    = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const connectDB = require('./config/db');
const socket   = require('./config/socket');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes    = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const quoteRoutes         = require('./routes/quoteRoutes');
const notificationRoutes  = require('./routes/notificationRoutes');
const offerRoutes         = require('./routes/offerRoutes');
const menuRoutes          = require('./routes/menuRoutes');
const vendorRoutes        = require('./routes/vendorRoutes');
const productUnitRoutes   = require('./routes/productUnitRoutes');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5014;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Routes
app.get('/', (req, res) => res.send('Rental App API is running...'));
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user',     userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/quotes',         quoteRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/offers',         offerRoutes);
app.use('/api/menus',          menuRoutes);
app.use('/api/vendors',        vendorRoutes);
app.use('/api/products/:productId/units', productUnitRoutes);

// Backfill userId for existing users who don't have one
async function backfillUserIds() {
  const { User } = require('./models/User');
  const users = await User.find({ userId: { $exists: false } }).sort({ createdAt: 1 });
  if (users.length === 0) return;
  const baseCount = await User.countDocuments({ userId: { $exists: true } });
  for (let i = 0; i < users.length; i++) {
    users[i].userId = `LR-USR-${String(baseCount + i + 1).padStart(3, '0')}`;
    await users[i].save();
  }
  console.log(`Backfilled userId for ${users.length} users`);
}

// Backfill bookingCode for existing bookings
async function backfillBookingCodes() {
  const Booking = require('./models/Booking');
  const bookings = await Booking.find({ bookingCode: { $exists: false } }).sort({ createdAt: 1 });
  if (bookings.length === 0) return;
  const baseCount = await Booking.countDocuments({ bookingCode: { $exists: true } });
  for (let i = 0; i < bookings.length; i++) {
    bookings[i].bookingCode = `LR-INV-${String(baseCount + i + 1).padStart(3, '0')}`;
    await bookings[i].save();
  }
  console.log(`Backfilled bookingCode for ${bookings.length} bookings`);
}

// Backfill ProductUnit records for existing products that have none
async function backfillProductUnits() {
  const Product     = require('./models/Product');
  const ProductUnit = require('./models/ProductUnit');

  const products = await Product.find({}).lean();
  let created = 0;

  for (const p of products) {
    const existing = await ProductUnit.countDocuments({ productId: p._id });
    if (existing > 0) continue;

    const total     = p.totalQuantity     || 1;
    const available = p.availableQuantity ?? total;
    const rented    = Math.max(0, total - available);

    // Create available units first, then rented ones
    for (let i = 0; i < total; i++) {
      const status = i < available ? 'available' : 'rented';
      // Build unitCode manually to avoid save-hook race condition on bulk insert
      const seq      = i + 1;
      const unitCode = `${p.sku}-U${String(seq).padStart(2, '0')}`;
      await ProductUnit.create({ productId: p._id, unitCode, status });
      created++;
    }
  }

  if (created > 0) console.log(`Backfilled ${created} product unit records`);
}

// Start
connectDB().then(async () => {
  await backfillUserIds();
  await backfillBookingCodes();
  await backfillProductUnits();
  socket.init(server)
  server.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
});
