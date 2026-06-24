const express = require('express');
const router  = express.Router();
const vc      = require('../controllers/vendorController');

router.get('/',                              vc.getVendors);
router.get('/:id',                           vc.getVendor);
router.post('/',                             vc.createVendor);
router.put('/:id',                           vc.updateVendor);
router.delete('/:id',                        vc.deleteVendor);
router.get('/:id/orders',                    vc.getVendorOrders);
router.get('/:id/payables',                  vc.getVendorPayables);
router.post('/:id/comments',                 vc.addComment);
router.delete('/:id/comments/:commentId',    vc.deleteComment);
router.get('/:id/monthly-expenses',          vc.getMonthlyExpenses);

module.exports = router;
