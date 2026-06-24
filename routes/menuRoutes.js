const express = require('express');
const router  = express.Router();
const mc      = require('../controllers/menuController');

router.get('/',           mc.getMenus);
router.get('/:handle',    mc.getMenu);
router.post('/',          mc.createMenu);
router.put('/:handle',    mc.updateMenu);
router.delete('/:id',     mc.deleteMenu);

module.exports = router;
