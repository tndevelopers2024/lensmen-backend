const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');

router.get('/stats', adminController.getStats);
router.post('/sync-stock', adminController.syncStock);
router.get('/products', productController.getAllProductsAdmin);
router.get('/bookings', adminController.getAllBookings);
router.put('/bookings/:id/status', adminController.updateBookingStatus);
router.delete('/bookings/:id', adminController.deleteBooking);
router.get('/users', adminController.getAllUsers);
router.get('/users/lookup/:userId', adminController.lookupUserById);
router.put('/users/:id/kyc', adminController.verifyKyc);
router.put('/users/:id/class', adminController.updateUserClass);
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
