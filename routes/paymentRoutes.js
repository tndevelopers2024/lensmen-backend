const express           = require('express');
const router            = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/accounts/summary', paymentController.getAccountsSummary);
router.get('/accounts/revenue', paymentController.getRevenueByPeriod);
router.post('/:id',             paymentController.recordPayment);

module.exports = router;
