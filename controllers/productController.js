const Product = require('../models/Product');

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
    const categories = await Product.distinct('category', { category: { $ne: null, $ne: '' } });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { name, description, pricePerDay, category, sku, totalQuantity, availableQuantity, condition } = req.body;
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5014}`;
    const imageFile = req.files?.image?.[0];
    const imageUrl  = imageFile ? `${baseUrl}/uploads/${imageFile.filename}` : '';
    const galleryImages = (req.files?.gallery || []).map(f => `${baseUrl}/uploads/${f.filename}`);

    const total     = parseInt(totalQuantity)     || 1;
    const available = parseInt(availableQuantity) ?? total;

    const product = new Product({
      name, description, pricePerDay, imageUrl, galleryImages, category,
      sku: sku || undefined,
      totalQuantity: total,
      availableQuantity: Math.min(available, total),
      condition: condition || 'Good',
    });

    const saved = await product.save();
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

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5014}`;
    if (req.files?.image?.[0]) {
      updateData.imageUrl = `${baseUrl}/uploads/${req.files.image[0].filename}`;
    }
    // existingGallery = JSON array of kept URLs sent from the client
    const keptUrls = req.body.existingGallery ? JSON.parse(req.body.existingGallery) : null;
    const newGallery = (req.files?.gallery || []).map(f => `${baseUrl}/uploads/${f.filename}`);
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
