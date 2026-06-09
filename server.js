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

// Start
connectDB().then(() => {
  socket.init(server)
  server.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
});
