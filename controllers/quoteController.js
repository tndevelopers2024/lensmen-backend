const Quote   = require('../models/Quote');
const Booking = require('../models/Booking');
const Product = require('../models/Product');
const { User } = require('../models/User');
const socket  = require('../config/socket');

// GET /api/quotes
exports.getAll = async (req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/quotes/:id
exports.getOne = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const calcTotals = (items, totalDays, discountAmount, gstEnabled, gstPercent = 18) => {
  const subtotal      = (items || []).reduce((s, item) => s + (item.pricePerDay || 0) * (item.quantity || 1) * totalDays, 0);
  const discount      = Number(discountAmount) || 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const gstAmount     = gstEnabled ? Math.round(afterDiscount * gstPercent / 100) : 0;
  const totalPrice    = afterDiscount + gstAmount;
  return { subtotal, discountAmount: discount, gstEnabled: !!gstEnabled, gstPercent, gstAmount, totalPrice };
};

// POST /api/quotes
exports.create = async (req, res) => {
  try {
    const { quoteCode, customerName, customerMobile, customerEmail, items, startDate, endDate, notes, discountAmount, gstEnabled, gstPercent, raisedBy } = req.body;

    const start     = new Date(startDate);
    const end       = new Date(endDate);
    const totalDays = Math.max(1, Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1);
    const totals    = calcTotals(items, totalDays, discountAmount, gstEnabled, gstPercent);

    const quote = new Quote({
      ...(quoteCode?.trim() ? { quoteCode: quoteCode.trim() } : {}),
      customerName, customerMobile, customerEmail,
      items: items || [],
      startDate, endDate, totalDays,
      notes, raisedBy,
      ...totals,
    });

    await quote.save();
    res.status(201).json(quote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/quotes/:id
exports.update = async (req, res) => {
  try {
    const { quoteCode, customerName, customerMobile, customerEmail, items, startDate, endDate, notes, discountAmount, gstEnabled, gstPercent, raisedBy, status } = req.body;

    const start     = new Date(startDate);
    const end       = new Date(endDate);
    const totalDays = Math.max(1, Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1);
    const totals    = calcTotals(items, totalDays, discountAmount, gstEnabled, gstPercent);

    const updateData = { customerName, customerMobile, customerEmail, items: items || [], startDate, endDate, totalDays, notes, raisedBy, status, ...totals };
    if (quoteCode?.trim()) updateData.quoteCode = quoteCode.trim();

    const quote = await Quote.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    res.json(quote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/quotes/:id
exports.remove = async (req, res) => {
  try {
    await Quote.findByIdAndDelete(req.params.id);
    res.json({ message: 'Quote deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/quotes/:id/convert
exports.convertToOrder = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    if (quote.status === 'Converted') return res.status(400).json({ message: 'Already converted' });

    let initialStatus = 'Request Submitted';
    if (quote.customerEmail) {
      const user = await User.findOne({ email: quote.customerEmail });
      if (user?.kycStatus === 'Approved') initialStatus = 'KYC Approved';
      else if (user) initialStatus = 'KYC Pending';
    }

    const bookingItems = quote.items.map(item => ({
      productId:   item.productId,
      name:        item.name,
      pricePerDay: item.pricePerDay,
      imageUrl:    item.imageUrl || '',
    }));

    for (const item of bookingItems) {
      if (item.productId) await Product.findByIdAndUpdate(item.productId, { isAvailable: false });
    }

    const booking = new Booking({
      productId:   bookingItems[0]?.productId,
      items:       bookingItems,
      userName:    quote.customerName,
      userEmail:   quote.customerEmail  || '',
      userMobile:  quote.customerMobile || '',
      userAddress: '',
      accountType: 'Private',
      startDate:   quote.startDate,
      endDate:     quote.endDate,
      totalDays:   quote.totalDays,
      totalPrice:  quote.totalPrice,
      status:      initialStatus,
    });
    await booking.save();

    quote.status             = 'Converted';
    quote.convertedBookingId = booking._id;
    await quote.save();

    if (quote.customerEmail) {
      const user = await User.findOne({ email: quote.customerEmail });
      const isNewAccount = user?.adminCreated && !user?.password;
      socket.notify({
        recipient: quote.customerEmail,
        type: 'booking_new',
        title: isNewAccount ? 'Welcome to Lensmen Rentals! 🎉' : 'Rental Order Confirmed',
        message: isNewAccount
          ? `Your rental order ${booking.bookingCode} has been created. Your account is ready — open the app and click "Forgot Password" to set your password and access your orders.`
          : `Your quote has been converted to a rental order (${booking.bookingCode}).`,
        orderId: booking._id,
      }).catch(() => {});
    }

    res.json({ message: 'Quote converted to order', booking, quote });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
