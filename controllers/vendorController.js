const Vendor  = require('../models/Vendor');
const Booking = require('../models/Booking');
const socket  = require('../config/socket');

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.json(vendors);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json(vendor);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createVendor = async (req, res) => {
  try {
    const { name, companyName, email, phone, billingAddress, shippingAddress, address, gstNumber, notes } = req.body;
    const vendor = new Vendor({ name, companyName, email, phone, billingAddress, shippingAddress, address, gstNumber, notes });
    await vendor.save();
    socket.emit('vendor:updated');
    res.status(201).json(vendor);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateVendor = async (req, res) => {
  try {
    const { name, companyName, email, phone, billingAddress, shippingAddress, address, gstNumber, notes, isActive } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { name, companyName, email, phone, billingAddress, shippingAddress, address, gstNumber, notes, isActive },
      { new: true, runValidators: true }
    );
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    socket.emit('vendor:updated');
    res.json(vendor);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteVendor = async (req, res) => {
  try {
    await Vendor.findByIdAndDelete(req.params.id);
    socket.emit('vendor:updated');
    res.json({ message: 'Vendor deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vendors/:id/orders — all orders that have items from this vendor
exports.getVendorOrders = async (req, res) => {
  try {
    const bookings = await Booking.find({ 'items.vendorId': req.params.id })
      .select('bookingCode userName userMobile startDate endDate status items totalDays')
      .lean();

    const result = bookings.map(b => ({
      ...b,
      vendorItems: b.items.filter(i => String(i.vendorId) === req.params.id),
      vendorCostTotal: b.items
        .filter(i => String(i.vendorId) === req.params.id)
        .reduce((s, i) => s + (i.vendorCost || 0) * (b.totalDays || 1) * (i.quantity || 1), 0),
      vendorPaymentStatus: b.items
        .filter(i => String(i.vendorId) === req.params.id)
        .every(i => i.vendorPaymentStatus === 'Paid') ? 'Paid' : 'Pending',
      vendorPaidDate: b.items
        .filter(i => String(i.vendorId) === req.params.id)
        .find(i => i.vendorPaymentStatus === 'Paid')?.vendorPaidDate || null,
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vendors/:id/payables — total amount owed to this vendor
exports.getVendorPayables = async (req, res) => {
  try {
    const bookings = await Booking.find({ 'items.vendorId': req.params.id }).lean();
    let payable = 0;
    for (const b of bookings) {
      for (const item of b.items) {
        if (String(item.vendorId) === req.params.id) {
          payable += (item.vendorCost || 0) * (b.totalDays || 1) * (item.quantity || 1);
        }
      }
    }
    res.json({ payable });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/vendors/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Comment text required' });
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { text: text.trim(), createdAt: new Date() } } },
      { new: true }
    );
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json(vendor);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/vendors/:id/comments/:commentId
exports.deleteComment = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { $pull: { comments: { _id: req.params.commentId } } },
      { new: true }
    );
    res.json(vendor);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vendors/:id/monthly-expenses — monthly vendor cost totals (last 6 months)
exports.getMonthlyExpenses = async (req, res) => {
  try {
    const bookings = await Booking.find({ 'items.vendorId': req.params.id }).lean();
    const monthly = {};
    for (const b of bookings) {
      const month = new Date(b.startDate).toISOString().slice(0, 7); // YYYY-MM
      for (const item of b.items) {
        if (String(item.vendorId) === req.params.id) {
          monthly[month] = (monthly[month] || 0) + (item.vendorCost || 0) * (b.totalDays || 1) * (item.quantity || 1);
        }
      }
    }
    // Build last 6 months
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      result.push({ month: key, amount: monthly[key] || 0 });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
