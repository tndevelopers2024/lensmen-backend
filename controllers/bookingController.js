const Booking = require('../models/Booking');
const Product = require('../models/Product');
const { User } = require('../models/User');
const socket  = require('../config/socket');

exports.createBooking = async (req, res) => {
  const { productId, products, userName, userEmail, userAddress, userMobile, accountType, startDate, endDate, quantity, notes } = req.body;
  const qty = Math.max(1, parseInt(quantity) || 1);

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) || 1;

  if (diffDays > 10) {
    return res.status(400).json({ message: 'Booking cannot exceed 10 days' });
  }

  try {
    let bookingItems = [];
    let totalPrice = 0;

    if (products && Array.isArray(products)) {
      for (const p of products) {
        const product = await Product.findById(p._id);
        if (!product || !product.isAvailable) {
          return res.status(400).json({ message: `Product ${product?.name || p._id} is not available` });
        }
        bookingItems.push({ productId: product._id, name: product.name, pricePerDay: product.pricePerDay, imageUrl: product.imageUrl, quantity: 1 });
        totalPrice += diffDays * product.pricePerDay;
      }
    } else if (productId) {
      const product = await Product.findById(productId);
      if (!product || !product.isAvailable) {
        return res.status(400).json({ message: 'Product is not available' });
      }
      const avail = product.availableQuantity ?? 1;
      if (qty > avail) {
        return res.status(400).json({ message: `Only ${avail} unit${avail > 1 ? 's' : ''} available` });
      }
      bookingItems.push({ productId: product._id, name: product.name, pricePerDay: product.pricePerDay, imageUrl: product.imageUrl, quantity: qty });
      totalPrice = diffDays * product.pricePerDay * qty;
    } else {
      return res.status(400).json({ message: 'No products selected' });
    }

    let initialStatus = 'Request Submitted';
    const userDoc = await User.findOne({ email: userEmail });
    if (userDoc) {
      initialStatus = userDoc.kycStatus === 'Approved' ? 'KYC Approved' : 'KYC Pending';
    }

    const booking = new Booking({
      productId: bookingItems[0].productId,
      quantity: qty,
      items: bookingItems,
      userName, userEmail, userAddress, userMobile, accountType,
      startDate, endDate,
      totalDays: diffDays,
      totalPrice,
      status: initialStatus,
      notes,
    });

    const newBooking = await booking.save();

    // Decrement availableQuantity by the booked quantity
    for (const item of bookingItems) {
      const prod = await Product.findById(item.productId);
      if (prod) {
        prod.availableQuantity = Math.max(0, (prod.availableQuantity ?? 1) - (item.quantity || 1));
        prod.isAvailable = prod.availableQuantity > 0;
        await prod.save();
      }
    }

    socket.emit('booking:new', { userEmail: newBooking.userEmail })

    const itemNames = bookingItems.map(i => i.name).join(', ')
    // Notify admin of new booking
    socket.notify({
      recipient: 'admin',
      type: 'booking_new',
      title: 'New Rental Request',
      message: `${userName} requested: ${itemNames}`,
      orderId: newBooking._id,
    })

    res.status(201).json(newBooking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userEmail: req.params.email })
      .populate('productId')
      .populate('items.productId')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProductBookings = async (req, res) => {
  try {
    const active = ['Request Submitted', 'KYC Pending', 'KYC Approved', 'Approved',
      'Ready for Pickup', 'Picked Up', 'During Rental', 'Return Pending', 'Active'];
    const bookings = await Booking.find({
      $or: [{ productId: req.params.id }, { 'items.productId': req.params.id }],
      status: { $in: active },
    }).select('startDate endDate status');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Restore availableQuantity using stored item quantity
    const itemsToRestore = booking.items?.length
      ? booking.items
      : booking.productId ? [{ productId: booking.productId, quantity: booking.quantity || 1 }] : [];

    for (const item of itemsToRestore) {
      const prod = await Product.findById(item.productId);
      if (prod) {
        const restore = item.quantity || booking.quantity || 1;
        prod.availableQuantity = Math.min(prod.totalQuantity ?? 1, (prod.availableQuantity ?? 0) + restore);
        prod.isAvailable = prod.availableQuantity > 0;
        await prod.save();
      }
    }

    const userEmail  = booking.userEmail
    const cancelName = booking.userName
    const cancelItem = booking.items?.[0]?.name || 'order'
    await Booking.findByIdAndDelete(req.params.id);
    socket.emit('booking:cancelled', { userEmail })
    socket.notify({
      recipient: 'admin',
      type: 'cancelled',
      title: 'Order Cancelled',
      message: `${cancelName} cancelled their rental of ${cancelItem}`,
    })
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
