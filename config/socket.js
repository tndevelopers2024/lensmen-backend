const Notification = require('../models/Notification')

let _io = null

module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io')
    _io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    })
    _io.on('connection', (socket) => {
      // Client tells us which room to join (email or 'admin')
      socket.on('join', ({ room }) => {
        if (room) socket.join(room)
      })
      socket.on('disconnect', () => {})
    })
    return _io
  },

  get io() { return _io },

  // Broadcast to everyone (existing usage for product/order list refresh)
  emit: (event, data) => {
    if (_io) _io.emit(event, data)
  },

  // Send to a specific room (email or 'admin')
  emitTo: (room, event, data) => {
    if (_io) _io.to(room).emit(event, data)
  },

  // Save notification to DB + push to recipient's socket room
  notify: async ({ recipient, type, title, message, orderId = null }) => {
    try {
      const n = await Notification.create({ recipient, type, title, message, orderId })
      if (_io) _io.to(recipient).emit('notification:new', n)
      return n
    } catch (err) {
      console.error('notify error:', err.message)
    }
  },
}
