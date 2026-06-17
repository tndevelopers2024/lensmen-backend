const express            = require('express');
const router             = express.Router();
const categoryController = require('../controllers/categoryController');

router.get('/',            categoryController.getAll);
router.post('/',           categoryController.create);
router.put('/reorder',     categoryController.reorder);
router.put('/:id',         categoryController.update);
router.delete('/:id',      categoryController.remove);

module.exports = router;
