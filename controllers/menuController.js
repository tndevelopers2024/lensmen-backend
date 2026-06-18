const Menu    = require('../models/Menu')
const Category = require('../models/Category')
const Product  = require('../models/Product')

// GET /api/menus — list all (admin)
exports.getAll = async (req, res) => {
  try {
    const menus = await Menu.find().sort({ createdAt: 1 }).lean()
    res.json(menus)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/menus/:handle — get by handle (public, storefront)
exports.getByHandle = async (req, res) => {
  try {
    const menu = await Menu.findOne({ handle: req.params.handle }).lean()
    if (!menu) return res.status(404).json({ message: 'Menu not found' })
    res.json(menu)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/menus
exports.create = async (req, res) => {
  try {
    const { name, handle } = req.body
    if (!name?.trim() || !handle?.trim()) return res.status(400).json({ message: 'Name and handle required' })
    const slug = handle.trim().toLowerCase().replace(/\s+/g, '-')
    const exists = await Menu.findOne({ handle: slug })
    if (exists) return res.status(400).json({ message: 'Handle already in use' })
    const menu = new Menu({ name: name.trim(), handle: slug, items: [] })
    await menu.save()
    res.status(201).json(menu)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// PUT /api/menus/:id — update name + full items array
exports.update = async (req, res) => {
  try {
    const { name, items } = req.body
    const menu = await Menu.findById(req.params.id)
    if (!menu) return res.status(404).json({ message: 'Menu not found' })
    if (name) menu.name = name.trim()
    if (items !== undefined) menu.items = items
    menu.updatedAt = new Date()
    await menu.save()
    res.json(menu)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// DELETE /api/menus/:id
exports.remove = async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id)
    if (!menu) return res.status(404).json({ message: 'Menu not found' })
    if (menu.handle === 'main-menu')    return res.status(400).json({ message: 'Cannot delete the main menu' })
    if (menu.handle === 'sidebar-menu') return res.status(400).json({ message: 'Cannot delete the sidebar menu' })
    await Menu.findByIdAndDelete(req.params.id)
    res.json({ message: 'Menu deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /api/menus/seed-main — auto-create main-menu from categories (first-time setup)
exports.seedMain = async (req, res) => {
  try {
    await Menu.findOneAndDelete({ handle: 'main-menu' })
    const cats = await Category.find().sort({ position: 1, name: 1 }).lean()
    const items = [
      { label: 'All', type: 'all', position: 0, children: [] },
      ...cats.map((c, i) => ({
        label:        c.name,
        type:         'category',
        categoryName: c.name,
        imageUrl:     c.imageUrl || '',
        position:     i + 1,
        children:     (c.subcategories || []).map((s, j) => ({
          label: s, type: 'category', categoryName: c.name, position: j,
        })),
      })),
    ]
    const menu = new Menu({ name: 'Main Navigation', handle: 'main-menu', items })
    await menu.save()
    res.status(201).json(menu)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

// POST /api/menus/seed-sidebar — auto-create sidebar-menu from categories (with images)
exports.seedSidebar = async (req, res) => {
  try {
    await Menu.findOneAndDelete({ handle: 'sidebar-menu' })
    const cats = await Category.find().sort({ position: 1, name: 1 }).lean()
    const items = [
      { label: 'All', type: 'all', position: 0, children: [] },
      ...cats.map((c, i) => ({
        label:        c.name,
        type:         'category',
        categoryName: c.name,
        imageUrl:     c.imageUrl || '',
        position:     i + 1,
        children:     [],
      })),
    ]
    const menu = new Menu({ name: 'Sidebar Navigation', handle: 'sidebar-menu', items })
    await menu.save()
    res.status(201).json(menu)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
