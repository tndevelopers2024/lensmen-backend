const Booking = require('../models/Booking');
const Product = require('../models/Product');
const { User, formatUserResponse } = require('../models/User');
const socket          = require('../config/socket');
const transporter     = require('../config/mailer');
const emailTemplates  = require('../utils/emailTemplates');
const { sendWhatsApp, fmtDate, itemNames } = require('../config/whatsapp');

const sendEmail = async (to, tpl) => {
  if (!tpl || !to) return
  try {
    await transporter.sendMail({ from: `Lensmen Rentals <${process.env.EMAIL_USER}>`, to, subject: tpl.subject, html: tpl.html })
  } catch (e) { console.error('Email send failed:', e.message) }
}

exports.getStats = async (req, res) => {
  try {
    const productCount = await Product.countDocuments();
    const bookingCount = await Booking.countDocuments();
    const bookings = await Booking.find();
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    res.json({ productCount, bookingCount, totalRevenue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('productId')
      .populate('items.productId')
      .sort({ createdAt: -1 })
      .lean();

    const bookingsWithUserKyc = await Promise.all(
      bookings.map(async (booking) => {
        const user = await User.findOne({ email: booking.userEmail }).select('-password').lean();
        return { ...booking, userKyc: user || null };
      })
    );

    res.json(bookingsWithUserKyc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { fullName, email, mobile } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'User already exists', user: formatUserResponse(existing) });
    const user = new User({ fullName: fullName || email, email, mobile: mobile || '', password: '', isVerified: true, adminCreated: true });
    await user.save();
    res.status(201).json(formatUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.checkUserEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email }).select('-password');
    res.json({ exists: !!user, user: user || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.lookupUserById = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { status, returnCondition, returnNotes, rejectionReason, reopenNotes, pickupLocation,
            isEarlyReturn, actualReturnDate, actualDays, adjustedTotal, cancellationReason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const RELEASED = ['Returned', 'Closed', 'Rejected', 'Cancelled'];
    const wasReleased = RELEASED.includes(booking.status);
    const willBeReleased = RELEASED.includes(status);

    booking.status = status;
    if (returnCondition) booking.returnCondition = returnCondition;
    if (returnNotes !== undefined) booking.returnNotes = returnNotes;
    if (rejectionReason !== undefined) booking.rejectionReason = rejectionReason;
    if (reopenNotes !== undefined) booking.reopenNotes = reopenNotes;
    if (pickupLocation !== undefined) booking.pickupLocation = pickupLocation;
    if (cancellationReason !== undefined) booking.cancellationReason = cancellationReason;

    // Handle early return: recalculate days and price
    if (status === 'Returned' && isEarlyReturn && actualReturnDate) {
      booking.isEarlyReturn    = true;
      booking.actualReturnDate = new Date(actualReturnDate);
      booking.endDate          = new Date(actualReturnDate);
      if (actualDays) booking.actualDays = actualDays;
      if (adjustedTotal !== undefined) {
        booking.totalPrice    = Math.max(0, adjustedTotal);
        const paid            = booking.totalPaid || 0;
        const netBalance      = paid - booking.totalPrice;
        // positive = refund owed to customer, negative = customer still owes
        booking.earlyReturnRefund = netBalance;
        booking.pendingAmount     = netBalance < 0 ? Math.abs(netBalance) : 0;
      }
    }

    await booking.save();

    // Restore stock when transitioning active → released
    if (!wasReleased && willBeReleased) {
      const itemsToRestore = booking.items?.length
        ? booking.items
        : booking.productId ? [{ productId: booking.productId, quantity: booking.quantity || 1 }] : [];

      for (const item of itemsToRestore) {
        const prod = await Product.findById(item.productId);
        if (prod) {
          const qty = item.quantity || 1;
          prod.availableQuantity = Math.min(prod.totalQuantity ?? 1, (prod.availableQuantity ?? 0) + qty);
          prod.isAvailable = prod.availableQuantity > 0;
          await prod.save();
        }
      }
    }

    socket.emit('booking:updated', { userEmail: booking.userEmail, status })
    socket.emit('product:updated')

    // Notify the customer about their order status change
    const itemLabel = booking.items?.[0]?.name || 'your order'
    const USER_NOTIFICATIONS = {
      'KYC Approved':      { title: 'KYC Verified ✓',          message: `Your identity documents have been verified.` },
      'Approved':          { title: 'Rental Approved! 🎉',      message: `Your rental of ${itemLabel} has been approved.${booking.pickupLocation ? ` Pickup location: ${booking.pickupLocation}` : ''}` },
      'Ready for Pickup':  { title: 'Ready for Pickup 📦',      message: `${itemLabel} is packed and ready. Collect from: ${booking.pickupLocation || 'our store'}.` },
      'During Rental':     { title: 'Rental Started',           message: `Your rental period for ${itemLabel} has begun.` },
      'Return Pending':    { title: 'Return Due Soon ⏰',        message: `Please return ${itemLabel} by the scheduled time.` },
      'Returned':          { title: 'Return Confirmed ✓',       message: `We received ${itemLabel}. Thank you!` },
      'Closed':            { title: 'Order Closed',             message: `Your rental order has been closed. See you again!` },
      'Rejected':          { title: 'Rental Request Rejected',  message: rejectionReason ? `Reason: ${rejectionReason}` : `Your request for ${itemLabel} was not approved.` },
    }
    if (USER_NOTIFICATIONS[status]) {
      socket.notify({
        recipient: booking.userEmail,
        type: 'status_update',
        title: USER_NOTIFICATIONS[status].title,
        message: USER_NOTIFICATIONS[status].message,
        orderId: booking._id,
      })
      // Send email notification
      const emailTpl = emailTemplates.statusUpdate(booking, status, { pickupLocation, rejectionReason })
      await sendEmail(booking.userEmail, emailTpl)
    }

    // WhatsApp notification per status
    const wa   = (tpl, body, btn = null) => booking.userMobile
      ? sendWhatsApp(booking.userMobile, tpl, body, btn).catch(() => {}) : null
    const code = booking.bookingCode
    const items = itemNames(booking)
    const loc  = booking.pickupLocation || 'Our Store'
    const WA_STATUS = {
      'Approved':        () => wa('lr_order_approved',     [booking.userName, code, items, loc, fmtDate(booking.startDate)], code),
      'Ready for Pickup':() => wa('lr_order_ready_pickup', [booking.userName, code, items, loc, fmtDate(booking.startDate)], code),
      'Picked Up':       () => wa('lr_order_picked_up',    [booking.userName, code, items, fmtDate(booking.endDate)], code),
      'Return Pending':  () => wa('lr_return_due_soon',    [booking.userName, code, items, fmtDate(booking.endDate)], code),
      'Returned':        () => wa('lr_order_returned',     [booking.userName, code, items], code),
      'Closed':          () => wa('lr_order_closed',       [booking.userName, code, items], code),
      'Rejected':        () => wa('lr_order_rejected',     [booking.userName, code, rejectionReason || 'Request not approved']),
    }
    if (WA_STATUS[status]) WA_STATUS[status]()

    res.json({ message: `Booking marked as ${status}`, status, booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verifyKyc = async (req, res) => {
  try {
    const { kycStatus, kycRejectionReason } = req.body;
    if (!['Approved', 'Rejected'].includes(kycStatus)) {
      return res.status(400).json({ message: 'Invalid KYC status' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.kycStatus = kycStatus;
    user.kycRejectionReason = kycStatus === 'Rejected'
      ? (kycRejectionReason || 'Documents rejected by admin')
      : undefined;
    await user.save();

    // Email notification
    const kycTpl = kycStatus === 'Approved'
      ? emailTemplates.kycApproved(user.fullName || user.email)
      : emailTemplates.kycRejected(user.fullName || user.email, kycRejectionReason)
    await sendEmail(user.email, kycTpl)

    // WhatsApp notification
    if (user.mobile) {
      if (kycStatus === 'Approved') {
        sendWhatsApp(user.mobile, 'lr_kyc_approved', [user.fullName || user.email]).catch(() => {})
      } else {
        sendWhatsApp(user.mobile, 'lr_kyc_rejected', [
          user.fullName || user.email,
          kycRejectionReason || 'Documents could not be verified',
        ]).catch(() => {})
      }
    }

    res.json({ message: `KYC status updated to ${kycStatus}`, user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.syncStock = async (req, res) => {
  try {
    const ACTIVE = ['Request Submitted', 'KYC Pending', 'KYC Approved', 'Approved',
      'Ready for Pickup', 'Picked Up', 'During Rental', 'Return Pending', 'Active']

    const [products, activeBookings] = await Promise.all([
      Product.find(),
      Booking.find({ status: { $in: ACTIVE } }),
    ])

    // Count booked quantity per product across all active bookings
    const bookedMap = {}
    for (const booking of activeBookings) {
      const items = booking.items?.length
        ? booking.items
        : booking.productId ? [{ productId: booking.productId, quantity: booking.quantity || 1 }] : []
      for (const item of items) {
        const pid = item.productId.toString()
        bookedMap[pid] = (bookedMap[pid] || 0) + (item.quantity || 1)
      }
    }

    const updates = []
    for (const prod of products) {
      const booked = bookedMap[prod._id.toString()] || 0
      const total  = prod.totalQuantity ?? 1
      const avail  = Math.max(0, total - booked)
      if (prod.availableQuantity !== avail || prod.isAvailable !== (avail > 0)) {
        prod.availableQuantity = avail
        prod.isAvailable       = avail > 0
        updates.push(prod.save())
      }
    }

    await Promise.all(updates)
    socket.emit('product:updated')
    res.json({ message: `Stock synced — ${updates.length} product(s) updated` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin accounts' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUserClass = async (req, res) => {
  try {
    const { customerClass } = req.body;
    const validClasses = ['New', 'Regular', 'Frequent', 'VIP', 'Celebrity', 'Corporate'];
    if (!validClasses.includes(customerClass)) {
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
};

exports.updateBookingDetails = async (req, res) => {
  try {
    const { items, startDate, endDate, gstEnabled, gstRate, offerCode, discountAmount, totalPrice } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (items !== undefined) {
      booking.items = items;
      if (items.length > 0) booking.productId = items[0].productId;
    }
    if (startDate !== undefined)    booking.startDate  = new Date(startDate);
    if (endDate !== undefined)      booking.endDate    = new Date(endDate);
    if (gstEnabled !== undefined)    booking.gstEnabled    = gstEnabled;
    if (gstRate !== undefined)       booking.gstRate       = gstRate;
    if (offerCode !== undefined)     booking.offerCode     = offerCode;
    if (discountAmount !== undefined) booking.discountAmount = discountAmount;
    if (totalPrice !== undefined)    booking.totalPrice    = totalPrice;

    if (booking.startDate && booking.endDate) {
      const s = new Date(new Date(booking.startDate).toDateString());
      const e = new Date(new Date(booking.endDate).toDateString());
      booking.totalDays = Math.max(1, Math.round((e - s) / 86400000) + 1);
    }

    // Recalculate total price based on updated items and days
    if (items !== undefined || startDate !== undefined || endDate !== undefined) {
      const days = booking.totalDays || 1;
      const subtotal = (booking.items || []).reduce((s, it) => s + (it.pricePerDay || 0) * (it.quantity || 1) * days, 0);
      booking.totalPrice   = subtotal - (booking.discountAmount || 0);
      booking.pendingAmount = Math.max(0, booking.totalPrice - (booking.totalPaid || 0));
    }

    await booking.save();
    socket.emit('booking:updated', { userEmail: booking.userEmail });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAdminNotes = async (req, res) => {
  try {
    const { text, deleteIndex } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (deleteIndex !== undefined) {
      booking.adminNotes.splice(deleteIndex, 1);
    } else {
      if (!text?.trim()) return res.status(400).json({ message: 'Note text is required' });
      booking.adminNotes.push({ text: text.trim() });
    }
    await booking.save();
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.archiveBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    booking.isArchived = true;
    booking.archivedAt = new Date();
    await booking.save();
    res.json({ message: 'Order archived' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.restoreBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    booking.isArchived = false;
    booking.archivedAt = null;
    await booking.save();
    res.json({ message: 'Order restored' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.permanentDeleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.isArchived) return res.status(400).json({ message: 'Order must be archived before permanent deletion' });
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendOverdueReminder = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const mobile  = booking.userMobile;
    const name    = booking.userName || 'Customer';
    const code    = booking.bookingCode || booking._id.toString();
    const items   = itemNames(booking.items || []);
    const pending = booking.pendingAmount || 0;
    const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(booking.endDate)) / 86400000));

    if (!mobile) return res.status(400).json({ message: 'No mobile number on booking' });

    await sendWhatsApp(mobile, 'lr_payment_overdue', [name, code, items, String(pending), String(overdueDays)], code);
    res.json({ message: 'Reminder sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.assignItemVendor = async (req, res) => {
  try {
    const { itemIndex, vendorId, vendorName, vendorCost } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.items[itemIndex]) return res.status(404).json({ message: 'Item not found' });

    booking.items[itemIndex].vendorId   = vendorId   || null;
    booking.items[itemIndex].vendorName = vendorName || '';
    booking.items[itemIndex].vendorCost = Number(vendorCost) || 0;
    booking.markModified('items');
    await booking.save();
    socket.emit('booking:updated', { userEmail: booking.userEmail });
    res.json({ message: 'Vendor assigned', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markVendorPayment = async (req, res) => {
  try {
    const { vendorId, status, paidAmount } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    let changed = false;
    booking.items.forEach((item, idx) => {
      if (String(item.vendorId) === String(vendorId)) {
        booking.items[idx].vendorPaymentStatus = status;
        booking.items[idx].vendorPaidDate      = status === 'Paid' ? new Date() : null;
        booking.items[idx].vendorPaidAmount    = status === 'Paid' ? Number(paidAmount) || 0 : 0;
        changed = true;
      }
    });

    if (!changed) return res.status(404).json({ message: 'No items found for this vendor in this booking' });
    booking.markModified('items');
    await booking.save();
    socket.emit('booking:updated', { userEmail: booking.userEmail });
    socket.emit('vendor:updated');
    res.json({ message: 'Vendor payment updated', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.assignItemUnit = async (req, res) => {
  try {
    const { itemIndex, unitId, unitCode } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.items[itemIndex]) return res.status(404).json({ message: 'Item not found' });

    const ProductUnit = require('../models/ProductUnit');

    // Unmark previous unit if there was one
    const prevUnitId = booking.items[itemIndex].unitId;
    if (prevUnitId && String(prevUnitId) !== String(unitId)) {
      await ProductUnit.findByIdAndUpdate(prevUnitId, { status: 'available', currentBookingId: null });
    }

    if (unitId) {
      // Mark new unit as rented
      await ProductUnit.findByIdAndUpdate(unitId, { status: 'rented', currentBookingId: booking._id });
      booking.items[itemIndex].unitId   = unitId;
      booking.items[itemIndex].unitCode = unitCode || '';
    } else {
      // Clearing assignment
      booking.items[itemIndex].unitId   = null;
      booking.items[itemIndex].unitCode = '';
    }

    booking.markModified('items');
    await booking.save();
    socket.emit('booking:updated', { userEmail: booking.userEmail });
    socket.emit('product:updated');
    res.json({ message: 'Unit assigned', booking });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createManualBooking = async (req, res) => {
  try {
    const { userName, userEmail, userMobile, userAddress, accountType, items, startDate, endDate, totalDays, totalPrice, discountAmount, notes, status } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'At least one item required' });
    if (!startDate || !endDate) return res.status(400).json({ message: 'Start and end date required' });

    const user = userEmail ? await User.findOne({ email: userEmail }) : null;
    let initialStatus = status || 'Approved';
    if (user?.kycStatus === 'Approved') initialStatus = status || 'KYC Approved';

    const booking = new Booking({
      productId:     items[0]?.productId,
      items,
      userName:      userName || '',
      userEmail:     userEmail || '',
      userMobile:    userMobile || '',
      userAddress:   userAddress || '',
      accountType:   accountType || 'Private',
      startDate:     new Date(startDate),
      endDate:       new Date(endDate),
      totalDays:     totalDays || 1,
      totalPrice:    totalPrice || 0,
      discountAmount: discountAmount || 0,
      originalPrice:  totalPrice || 0,
      notes:         notes || '',
      status:        initialStatus,
      pendingAmount: totalPrice || 0,
    });
    await booking.save();

    socket.emit('booking:updated', { userEmail: booking.userEmail });
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
