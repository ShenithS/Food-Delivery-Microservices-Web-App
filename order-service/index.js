const express = require('express');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
require('dotenv').config();

const app = express();
app.use(express.json());

// ── MongoDB Connection ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/food-delivery-orders';
mongoose.connect(MONGO_URI)
  .then(() => console.log(' Order Service connected to MongoDB'))
  .catch(err => console.error(' MongoDB connection error:', err.message));

// ── Order Schema & Model ───────────────────────────────────────────
const orderItemSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  price: { type: Number, required: true },
  qty:   { type: Number, default: 1 },
});

const orderSchema = new mongoose.Schema({
  userId:       { type: String, required: true },
  restaurantId: { type: String, required: true },
  items:        [orderItemSchema],
  totalPrice:   { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending',
  },
  deliveryAddress: { type: String, required: true },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// ── Swagger ────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Order Service API', version: '1.0.0', description: 'Manages orders for Food Delivery App' },
    servers: [{ url: 'http://localhost:3003' }],
  },
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// ── Health Routes ───────────────────────────────────────────


app.get('/health', (req, res) => {
  res.json({ status: 'UP', time: new Date().toISOString() });
});
// ── Routes ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all orders
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: List of all orders
 */
app.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order found
 *       404:
 *         description: Order not found
 */
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /orders/user/{userId}:
 *   get:
 *     summary: Get all orders by user ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Orders for the user
 */
app.get('/orders/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Place a new order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, restaurantId, items, totalPrice, deliveryAddress]
 *             properties:
 *               userId:       { type: string, example: 64abc123 }
 *               restaurantId: { type: string, example: 64def456 }
 *               totalPrice:   { type: number, example: 1850 }
 *               deliveryAddress: { type: string, example: No 5, Galle Road, Colombo 03 }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:  { type: string, example: Rice & Curry }
 *                     price: { type: number, example: 450 }
 *                     qty:   { type: integer, example: 2 }
 *     responses:
 *       201:
 *         description: Order placed successfully
 */
app.post('/orders', async (req, res) => {
  try {
    const order = new Order(req.body);
    const saved = await order.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, preparing, out_for_delivery, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Status updated
 */
app.patch('/orders/:id/status', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Cancel / delete an order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order deleted
 */
app.delete('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 404 Fallback ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(` Order Service running on http://localhost:${PORT}`);
  console.log(` Swagger: http://localhost:${PORT}/api-docs`);
});
