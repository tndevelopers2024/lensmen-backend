const Menu = require('../models/Menu');

exports.getMenus = async (req, res) => {
  try {
    const menus = await Menu.find().sort({ createdAt: 1 });
    res.json(menus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const menu = await Menu.findOne({ handle: req.params.handle });
    if (!menu) return res.json({ handle: req.params.handle, items: [] });
    res.json(menu);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createMenu = async (req, res) => {
  try {
    const { title, handle, position, items } = req.body;
    const existing = await Menu.findOne({ handle });
    if (existing) return res.status(400).json({ message: 'Handle already exists' });
    const menu = await Menu.create({ title, handle, position: position || '', items: items || [] });
    res.status(201).json(menu);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const { title, position, items } = req.body;
    const menu = await Menu.findOneAndUpdate(
      { handle: req.params.handle },
      { $set: { title, position, items } },
      { new: true, upsert: true }
    );
    res.json(menu);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    await Menu.findByIdAndDelete(req.params.id);
    res.json({ message: 'Menu deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
