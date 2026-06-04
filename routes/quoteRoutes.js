const express         = require('express');
const router          = express.Router();
const quoteController = require('../controllers/quoteController');

router.get('/',              quoteController.getAll);
router.get('/:id',           quoteController.getOne);
router.post('/',             quoteController.create);
router.put('/:id',           quoteController.update);
router.delete('/:id',        quoteController.remove);
router.post('/:id/convert',  quoteController.convertToOrder);

module.exports = router;
