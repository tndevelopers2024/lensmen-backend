const express = require('express')
const router  = express.Router()
const menuController = require('../controllers/menuController')

router.get('/',              menuController.getAll)
router.post('/seed-main',    menuController.seedMain)
router.post('/seed-sidebar', menuController.seedSidebar)
router.get('/:handle',       menuController.getByHandle)
router.post('/',             menuController.create)
router.put('/:id',           menuController.update)
router.delete('/:id',        menuController.remove)

module.exports = router
