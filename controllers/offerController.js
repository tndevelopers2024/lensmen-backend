const Offer = require('../models/Offer');

// ── Helpers ────────────────────────────────────────────────────
const calcDiscount = (offer, orderAmount) => {
  let discount = 0;
  if (offer.discountType === 'percentage') {
    discount = Math.round((orderAmount * offer.discountValue) / 100);
    if (offer.maxDiscount > 0) discount = Math.min(discount, offer.maxDiscount);
  } else {
    discount = Math.min(offer.discountValue, orderAmount);
  }
  return discount;
};

// ── Public: active offers for homepage display ─────────────────
exports.getActiveOffers = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
    }).sort({ createdAt: -1 });
    res.json(offers);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Public: validate a code against an order amount ───────────
exports.validateOffer = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    if (!code) return res.status(400).json({ message: 'Offer code is required' });

    const offer = await Offer.findOne({ code: code.toUpperCase().trim(), isActive: true });
    if (!offer) return res.status(404).json({ message: 'Invalid offer code' });

    if (offer.expiryDate && new Date() > offer.expiryDate)
      return res.status(400).json({ message: 'This offer has expired' });

    if (offer.usageLimit > 0 && offer.usedCount >= offer.usageLimit)
      return res.status(400).json({ message: 'This offer has reached its usage limit' });

    const amount = Number(orderAmount) || 0;
    if (amount < offer.minOrderAmount)
      return res.status(400).json({
        message: `Minimum order ₹${offer.minOrderAmount.toLocaleString('en-IN')} required`,
      });

    const discount = calcDiscount(offer, amount);

    res.json({
      valid: true,
      offerId: offer._id,
      code: offer.code,
      description: offer.description,
      discount,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      message: `${offer.code} applied — ₹${discount.toLocaleString('en-IN')} off!`,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Admin: list all ────────────────────────────────────────────
exports.getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Admin: create ──────────────────────────────────────────────
exports.createOffer = async (req, res) => {
  try {
    const { code, description, discountType, discountValue, minOrderAmount, maxDiscount, expiryDate, usageLimit, isActive } = req.body;
    const offer = new Offer({
      code,
      description,
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      maxDiscount: Number(maxDiscount) || 0,
      expiryDate: expiryDate || null,
      usageLimit: Number(usageLimit) || 0,
      isActive: isActive !== false,
    });
    await offer.save();
    res.status(201).json(offer);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Offer code already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Admin: update ──────────────────────────────────────────────
exports.updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    res.json(offer);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Admin: delete ──────────────────────────────────────────────
exports.deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Exported helper: apply offer inside a booking transaction ──
exports.applyOfferToBooking = async (offerCode, totalPrice) => {
  if (!offerCode) return { discount: 0, code: null };
  const offer = await Offer.findOne({ code: offerCode.toUpperCase().trim(), isActive: true });
  if (!offer) return { discount: 0, code: null };
  if (offer.expiryDate && new Date() > offer.expiryDate) return { discount: 0, code: null };
  if (offer.usageLimit > 0 && offer.usedCount >= offer.usageLimit) return { discount: 0, code: null };
  if (totalPrice < offer.minOrderAmount) return { discount: 0, code: null };

  const discount = calcDiscount(offer, totalPrice);
  offer.usedCount += 1;
  await offer.save();
  return { discount, code: offer.code };
};
