const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  recipient:  { type: String, required: true }, // user email or 'admin'
  type:       { type: String, required: true }, // 'booking_new' | 'status_update' | 'kyc' | 'cancelled'
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  read:       { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
})

notificationSchema.index({ recipient: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
