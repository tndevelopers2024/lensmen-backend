const Category = require('../models/Category');
const Product  = require('../models/Product');

// GET /api/categories  — list with product counts, sorted by position
exports.getAll = async (req, res) => {
  try {
    const categories = await Category.find().sort({ position: 1, name: 1 }).lean();
    const withCounts = await Promise.all(
      categories.map(async (c) => ({
        ...c,
        productCount: await Product.countDocuments({ category: c.name }),
      }))
    );
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/categories
exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

    const exists = await Category.findOne({ name: name.trim() });
    if (exists) return res.status(400).json({ message: 'Category already exists' });

    const last = await Category.findOne().sort({ position: -1 }).lean();
    const position = last ? (last.position || 0) + 1 : 0;

    const category = new Category({ name: name.trim(), description: description || '', position });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/categories/reorder — accepts [{ id, position }]
exports.reorder = async (req, res) => {
  try {
    const items = req.body; // [{ id, position }]
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Expected array' });
    await Promise.all(items.map(({ id, position }) =>
      Category.findByIdAndUpdate(id, { position })
    ));
    res.json({ message: 'Reordered' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/categories/:id  — rename cascades to products
exports.update = async (req, res) => {
  try {
    const { name, description, imageUrl, subcategories } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const newName = (name || '').trim();
    if (!newName) return res.status(400).json({ message: 'Name is required' });

    const oldName = category.name;
    if (newName !== oldName) {
      const dup = await Category.findOne({ name: newName, _id: { $ne: category._id } });
      if (dup) return res.status(400).json({ message: 'Another category with that name exists' });
      await Product.updateMany({ category: oldName }, { category: newName });
    }

    category.name = newName;
    if (description !== undefined) category.description = description;
    if (imageUrl !== undefined) category.imageUrl = imageUrl;
    if (subcategories !== undefined) category.subcategories = Array.isArray(subcategories) ? subcategories : [];
    await category.save();
    res.json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/categories/:id  — blocked if products still use it
exports.remove = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const inUse = await Product.countDocuments({ category: category.name });
    if (inUse > 0) {
      return res.status(400).json({ message: `Cannot delete — ${inUse} product(s) still use this category` });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
