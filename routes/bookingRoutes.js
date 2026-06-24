const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

router.post('/', bookingController.createBooking);
router.get('/user/:email', bookingController.getUserBookings);
router.get('/product/:id', bookingController.getProductBookings);
router.get('/code/:code',  bookingController.getByCode);
router.delete('/:id', bookingController.cancelBooking);

module.exports = router;
