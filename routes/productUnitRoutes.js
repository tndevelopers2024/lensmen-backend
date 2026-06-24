const express = require('express');
const router  = express.Router({ mergeParams: true }); // mergeParams to get :productId
const c       = require('../controllers/productUnitController');

router.get('/',           c.getUnits);
router.get('/available',  c.getAvailableUnits);
router.post('/',          c.addUnit);
router.post('/bulk',      c.addBulkUnits);
router.put('/:unitId',    c.updateUnit);
router.delete('/:unitId', c.deleteUnit);

module.exports = router;
