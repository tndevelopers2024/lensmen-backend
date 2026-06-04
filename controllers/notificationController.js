const Notification = require('../models/Notification')

// GET /api/notifications/:recipient
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.params.recipient })
      .sort({ createdAt: -1 })
      .limit(50)
    res.json(notifications)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/notifications/read-all/:recipient
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.params.recipient, read: false }, { read: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/notifications/:id
exports.deleteOne = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/notifications/clear/:recipient
exports.clearAll = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.params.recipient })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
