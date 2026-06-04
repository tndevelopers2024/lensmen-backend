const Quote   = require('../models/Quote');
const Booking = require('../models/Booking');
const Product = require('../models/Product');
const { User } = require('../models/User');

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

const calcTotals = (items, totalDays, discountAmount) => {
  const subtotal   = (items || []).reduce((s, item) => s + (item.pricePerDay || 0) * (item.quantity || 1) * totalDays, 0);
  const discount   = Number(discountAmount) || 0;
  const totalPrice = Math.max(0, subtotal - discount);
  return { subtotal, discountAmount: discount, totalPrice };
};

// POST /api/quotes
exports.create = async (req, res) => {
  try {
    const { customerName, customerMobile, customerEmail, items, startDate, endDate, notes, discountAmount } = req.body;

    const start     = new Date(startDate);
    const end       = new Date(endDate);
    const totalDays = Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
    const totals    = calcTotals(items, totalDays, discountAmount);

    const quote = new Quote({
      customerName, customerMobile, customerEmail,
      items: items || [],
      startDate, endDate, totalDays,
      notes,
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
    const { customerName, customerMobile, customerEmail, items, startDate, endDate, notes, discountAmount, status } = req.body;

    const start     = new Date(startDate);
    const end       = new Date(endDate);
    const totalDays = Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
    const totals    = calcTotals(items, totalDays, discountAmount);

    const quote = await Quote.findByIdAndUpdate(
      req.params.id,
      { customerName, customerMobile, customerEmail, items: items || [], startDate, endDate, totalDays, notes, status, ...totals },
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

    res.json({ message: 'Quote converted to order', booking, quote });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
