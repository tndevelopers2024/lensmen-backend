const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../middleware/upload');

router.get('/me', userController.getMe);
router.put('/profile', userController.updateProfile);
router.post('/kyc-reminder', userController.kycReminder);
router.post('/kyc', upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panFront', maxCount: 1 },
  { name: 'drivingLicense', maxCount: 1 },
]), userController.uploadKyc);

module.exports = router;
