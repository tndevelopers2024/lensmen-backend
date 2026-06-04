const express    = require('express')
const router     = express.Router()
const ctrl       = require('../controllers/notificationController')

router.get('/:recipient',             ctrl.getNotifications)
router.put('/:id/read',               ctrl.markRead)
router.put('/read-all/:recipient',    ctrl.markAllRead)
router.delete('/clear/:recipient',    ctrl.clearAll)
router.delete('/:id',                 ctrl.deleteOne)

module.exports = router
