const Booking = require('../models/Booking');
const Product = require('../models/Product');
const socket  = require('../config/socket');

// POST /api/payments/:id — record advance or final payment
exports.recordPayment = async (req, res) => {
  try {
    const { type, amount, mode, transactionId, notes } = req.body;

    if (!['advance', 'final'].includes(type)) {
      return res.status(400).json({ message: 'type must be advance or final' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount must be positive' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.payments.push({
      type,
      amount:        Number(amount),
      mode,
      transactionId: transactionId || '',
      notes:         notes || '',
    });

    booking.totalPaid     = booking.payments.reduce((sum, p) => sum + p.amount, 0);
    booking.pendingAmount = Math.max(0, (booking.totalPrice || 0) - booking.totalPaid);

    if (booking.pendingAmount === 0) {
      booking.paymentStatus = 'Fully Paid';
    } else if (booking.payments.some(p => p.type === 'advance')) {
      booking.paymentStatus = 'Advance Paid';
    }

    await booking.save();
    socket.emit('booking:updated', { userEmail: booking.userEmail, status: booking.status })
    res.json({ message: 'Payment recorded', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/payments/accounts/summary
exports.getAccountsSummary = async (req, res) => {
  try {
    const bookings = await Booking.find().lean();
    const products = await Product.find().lean();

    const totalRevenue   = bookings.reduce((s, b) => s + (b.totalPrice  || 0), 0);
    const totalCollected = bookings.reduce((s, b) => s + (b.totalPaid   || 0), 0);
    const totalPending   = bookings.reduce((s, b) => s + (b.pendingAmount || 0), 0);
    const totalAdvance   = bookings.reduce((s, b) => s + (b.payments || []).filter(p => p.type === 'advance').reduce((x, p) => x + p.amount, 0), 0);
    const totalFinal     = bookings.reduce((s, b) => s + (b.payments || []).filter(p => p.type === 'final').reduce((x, p) => x + p.amount, 0), 0);

    const outstanding = bookings
      .filter(b => ['Returned', 'Closed'].includes(b.status) && b.paymentStatus !== 'Fully Paid')
      .reduce((s, b) => s + (b.pendingAmount || 0), 0);

    const inventoryValue = products.reduce((s, p) => s + (p.pricePerDay || 0), 0);
    const productsInShop = products.filter(p => p.isAvailable).length;
    const productsRented = products.filter(p => !p.isAvailable).length;

    const ACTIVE = ['Picked Up', 'During Rental', 'Return Pending', 'Active', 'Approved', 'Ready for Pickup', 'KYC Approved', 'KYC Pending', 'Request Submitted'];
    const activeOrders = bookings.filter(b => ACTIVE.includes(b.status)).length;

    const now  = new Date();
    const in7  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingReturns = bookings
      .filter(b => ACTIVE.includes(b.status) && new Date(b.endDate) >= now && new Date(b.endDate) <= in7)
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
      .slice(0, 10)
      .map(b => ({
        _id:           b._id,
        userName:      b.userName,
        userMobile:    b.userMobile,
        endDate:       b.endDate,
        status:        b.status,
        totalPrice:    b.totalPrice,
        totalPaid:     b.totalPaid,
        pendingAmount: b.pendingAmount,
        items:         b.items,
      }));

    const productCount   = {};
    const productRevenue = {};
    bookings.forEach(b => {
      (b.items || []).forEach(item => {
        const name = item.name || 'Unknown';
        productCount[name]   = (productCount[name]   || 0) + 1;
        productRevenue[name] = (productRevenue[name] || 0) + (item.pricePerDay || 0) * (b.totalDays || 1);
      });
    });
    const topProducts = Object.entries(productCount)
      .map(([name, count]) => ({ name, count, revenue: productRevenue[name] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const customerSpend  = {};
    const customerOrders = {};
    const customerNames  = {};
    bookings.forEach(b => {
      if (!b.userEmail) return;
      customerSpend[b.userEmail]  = (customerSpend[b.userEmail]  || 0) + (b.totalPrice || 0);
      customerOrders[b.userEmail] = (customerOrders[b.userEmail] || 0) + 1;
      if (!customerNames[b.userEmail]) customerNames[b.userEmail] = b.userName || b.userEmail;
    });
    const topCustomers = Object.entries(customerSpend)
      .map(([email, spend]) => ({ email, spend, orders: customerOrders[email] || 0, name: customerNames[email] }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    res.json({
      totalRevenue, totalCollected, totalPending, outstanding,
      totalAdvance, totalFinal,
      inventoryValue, productsInShop, productsRented, activeOrders,
      upcomingReturns, topProducts, topCustomers,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/payments/accounts/revenue?period=daily|weekly|monthly
exports.getRevenueByPeriod = async (req, res) => {
  try {
    const period   = req.query.period || 'daily';
    const bookings = await Booking.find({ 'payments.0': { $exists: true } }).lean();

    const buckets = {};
    bookings.forEach(b => {
      (b.payments || []).forEach(p => {
        const d = new Date(p.collectedAt);
        let key;
        if (period === 'daily') {
          key = d.toISOString().slice(0, 10);
        } else if (period === 'weekly') {
          const day = d.getDay() || 7;
          const mon = new Date(d);
          mon.setDate(d.getDate() - day + 1);
          key = mon.toISOString().slice(0, 10);
        } else {
          key = d.toISOString().slice(0, 7);
        }
        buckets[key] = (buckets[key] || 0) + p.amount;
      });
    });

    const result = Object.entries(buckets)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-30);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
