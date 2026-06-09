const express = require('express');
const router  = express.Router();
const {
  getActiveOffers, validateOffer,
  getAllOffers, createOffer, updateOffer, deleteOffer,
} = require('../controllers/offerController');

// Public
router.get('/active',   getActiveOffers);
router.post('/validate', validateOffer);

// Admin (no auth middleware — matches existing pattern in this codebase)
router.get('/',         getAllOffers);
router.post('/',        createOffer);
router.put('/:id',      updateOffer);
router.delete('/:id',   deleteOffer);

module.exports = router;
