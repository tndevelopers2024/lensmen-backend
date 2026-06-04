const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../middleware/upload');

router.get('/', productController.getAvailableProducts);
router.get('/categories', productController.getCategories);
const productUpload = upload.fields([
  { name: 'image',   maxCount: 1 },
  { name: 'gallery', maxCount: 5 },
]);
router.post('/', productUpload, productController.createProduct);
router.put('/:id',  productUpload, productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
