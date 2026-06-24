const Product  = require('../models/Product');
const Category = require('../models/Category');

exports.getAvailableProducts = async (req, res) => {
  try {
    // Return all products — sold-out ones are shown with a tag, not hidden
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const cats = await Category.find().sort({ position: 1, name: 1 }).lean();
    if (cats.length > 0) {
      // Return full objects so frontend can use subcategories and imageUrl
      res.json(cats.map(c => ({
        name:          c.name,
        imageUrl:      c.imageUrl || '',
        subcategories: c.subcategories || [],
      })))
    } else {
      const names = await Product.distinct('category', { category: { $ne: null, $ne: '' } });
      res.json(names.map(n => ({ name: n, imageUrl: '', subcategories: [] })));
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, description, pricePerDay, category, sku, totalQuantity, availableQuantity, condition } = req.body;
    const imageFile = req.files?.image?.[0];
    const imageUrl  = imageFile ? `/uploads/${imageFile.filename}` : '';
    const galleryImages = (req.files?.gallery || []).map(f => `/uploads/${f.filename}`);

    const total     = parseInt(totalQuantity)     || 1;
    const available = Math.min(parseInt(availableQuantity) ?? total, total);

    const product = new Product({
      name, description, pricePerDay, imageUrl, galleryImages, category,
      sku: sku || undefined,
      totalQuantity: total,
      availableQuantity: available,
      condition: condition || 'Good',
    });

    const saved = await product.save();

    // Auto-create ProductUnit records
    const ProductUnit = require('../models/ProductUnit');
    for (let i = 0; i < total; i++) {
      const seq      = i + 1;
      const unitCode = `${saved.sku}-U${String(seq).padStart(2, '0')}`;
      const status   = i < available ? 'available' : 'rented';
      await ProductUnit.create({ productId: saved._id, unitCode, status });
    }

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAllProductsAdmin = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { name, description, pricePerDay, isAvailable, category, sku, totalQuantity, availableQuantity, condition } = req.body;

    const total     = totalQuantity     !== undefined ? parseInt(totalQuantity)     : undefined;
    const available = availableQuantity !== undefined ? parseInt(availableQuantity) : undefined;

    const updateData = {
      name, description, pricePerDay, category, condition,
      ...(sku               && { sku }),
      ...(total             !== undefined && { totalQuantity: total }),
      ...(available         !== undefined && { availableQuantity: Math.min(available, total ?? available) }),
    };

    // If availableQuantity explicitly set, derive isAvailable from it; otherwise honour the boolean flag
    if (available !== undefined) {
      updateData.isAvailable = available > 0;
    } else if (isAvailable !== undefined) {
      updateData.isAvailable = isAvailable === 'true' || isAvailable === true;
    }

    if (req.files?.image?.[0]) {
      updateData.imageUrl = `/uploads/${req.files.image[0].filename}`;
    }
    // existingGallery = JSON array of kept URLs sent from the client
    const keptUrls = req.body.existingGallery ? JSON.parse(req.body.existingGallery) : null;
    const newGallery = (req.files?.gallery || []).map(f => `/uploads/${f.filename}`);
    if (keptUrls !== null || newGallery.length) {
      const base = keptUrls !== null ? keptUrls : (await Product.findById(req.params.id).select('galleryImages'))?.galleryImages || [];
      updateData.galleryImages = [...base, ...newGallery].slice(0, 5);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
