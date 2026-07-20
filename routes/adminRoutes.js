const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const upload = require('../middleware/upload');

router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const base = (process.env.BASE_URL || '').replace(/\/$/, '');
  res.json({ url: `${base}/uploads/${req.file.filename}` });
});

router.get('/stats', adminController.getStats);
router.post('/sync-stock', adminController.syncStock);
router.get('/products', productController.getAllProductsAdmin);
router.get('/bookings',  adminController.getAllBookings);
router.post('/bookings', adminController.createManualBooking);
router.put('/bookings/:id/status', adminController.updateBookingStatus);
router.put('/bookings/:id/details', adminController.updateBookingDetails);
router.delete('/bookings/:id', adminController.archiveBooking);
router.put('/bookings/:id/restore', adminController.restoreBooking);
router.delete('/bookings/:id/permanent', adminController.permanentDeleteBooking);
router.post('/bookings/:id/remind',        adminController.sendOverdueReminder);
router.put('/bookings/:id/item-vendor',       adminController.assignItemVendor);
router.put('/bookings/:id/item-unit',         adminController.assignItemUnit);
router.put('/bookings/:id/vendor-payment',    adminController.markVendorPayment);
router.put('/bookings/:id/admin-notes',       adminController.updateAdminNotes);
router.post('/users',              adminController.createUser);
router.get('/users/check-email',   adminController.checkUserEmail);
router.get('/users',               adminController.getAllUsers);
router.get('/users/lookup/:userId', adminController.lookupUserById);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/kyc', adminController.verifyKyc);
router.put('/users/:id/class', adminController.updateUserClass);
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
