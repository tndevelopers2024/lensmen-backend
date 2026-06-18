const mongoose = require('mongoose')

const childItemSchema = new mongoose.Schema({
  label:       { type: String, required: true },
  type:        { type: String, enum: ['all','category','product','url'], default: 'category' },
  categoryName:{ type: String, default: '' },
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productName: { type: String, default: '' },
  url:         { type: String, default: '' },
  imageUrl:    { type: String, default: '' },
  position:    { type: Number, default: 0 },
}, { _id: true })

const menuItemSchema = new mongoose.Schema({
  label:       { type: String, required: true },
  type:        { type: String, enum: ['all','category','product','url'], default: 'category' },
  categoryName:{ type: String, default: '' },
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productName: { type: String, default: '' },
  url:         { type: String, default: '' },
  imageUrl:    { type: String, default: '' },
  position:    { type: Number, default: 0 },
  children:    { type: [childItemSchema], default: [] },
}, { _id: true })

const menuSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  handle:    { type: String, required: true, unique: true, trim: true },
  items:     { type: [menuItemSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Menu', menuSchema)
