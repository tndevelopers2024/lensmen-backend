const ProductUnit = require('../models/ProductUnit');
const Product     = require('../models/Product');
const socket      = require('../config/socket');

// ── helpers ──────────────────────────────────────────────────────────────────

// Recompute product's available/total from its units
const syncProductStock = async (productId) => {
  const units = await ProductUnit.find({ productId }).lean();
  const total = units.length;
  // Units that are merely 'rented' are still part of the viable inventory for future dates.
  const usable = units.filter(u => u.status !== 'maintenance' && u.status !== 'damaged').length;
  await Product.findByIdAndUpdate(productId, { totalQuantity: total, availableQuantity: usable, isAvailable: usable > 0 });
};

// ── controllers ───────────────────────────────────────────────────────────────

// GET /api/products/:productId/units
exports.getUnits = async (req, res) => {
  try {
    const units = await ProductUnit.find({ productId: req.params.productId })
      .sort({ unitCode: 1 }).lean();
    res.json(units);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/products/:productId/units/available  — available + currently-assigned unit
exports.getAvailableUnits = async (req, res) => {
  try {
    const { currentUnitId } = req.query;
    const query = { productId: req.params.productId, status: 'available' };
    const units = await ProductUnit.find(query).sort({ unitCode: 1 }).lean();
    // Also include the currently assigned unit so it shows in dropdown even if status=rented
    if (currentUnitId) {
      const current = await ProductUnit.findById(currentUnitId).lean();
      if (current && !units.find(u => String(u._id) === currentUnitId)) {
        units.unshift(current);
      }
    }
    res.json(units);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/products/:productId/units  — add one unit
exports.addUnit = async (req, res) => {
  try {
    const { serialNumber, condition, notes } = req.body;
    const unit = await ProductUnit.create({
      productId: req.params.productId,
      serialNumber: serialNumber || '',
      condition:    condition    || 'Good',
      notes:        notes        || '',
    });
    await syncProductStock(req.params.productId);
    socket.emit('product:updated');
    res.status(201).json(unit);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/products/:productId/units/bulk  — add N units at once
exports.addBulkUnits = async (req, res) => {
  try {
    const { count } = req.body;
    const n = Math.min(Math.max(parseInt(count) || 1, 1), 50);
    const created = [];
    for (let i = 0; i < n; i++) {
      const unit = await ProductUnit.create({ productId: req.params.productId });
      created.push(unit);
    }
    await syncProductStock(req.params.productId);
    socket.emit('product:updated');
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/products/:productId/units/:unitId
exports.updateUnit = async (req, res) => {
  try {
    const { status, serialNumber, condition, notes } = req.body;
    const unit = await ProductUnit.findByIdAndUpdate(
      req.params.unitId,
      { ...(status !== undefined       && { status }),
        ...(serialNumber !== undefined  && { serialNumber }),
        ...(condition !== undefined     && { condition }),
        ...(notes !== undefined         && { notes }),
      },
      { new: true }
    );
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    await syncProductStock(req.params.productId);
    socket.emit('product:updated');
    res.json(unit);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/products/:productId/units/:unitId
exports.deleteUnit = async (req, res) => {
  try {
    await ProductUnit.findByIdAndDelete(req.params.unitId);
    await syncProductStock(req.params.productId);
    socket.emit('product:updated');
    res.json({ message: 'Unit deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
