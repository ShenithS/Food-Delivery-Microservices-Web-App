const express = require('express');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
require('dotenv').config();

const app = express();
app.use(express.json());

// ── MongoDB Connection ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/food-delivery-deliveries';
mongoose.connect(MONGO_URI)
  .then(() => console.log(' Delivery Service connected to MongoDB'))
  .catch(err => console.error(' MongoDB connection error:', err.message));

// ── Delivery Schema & Model ────────────────────────────────────────
const deliverySchema = new mongoose.Schema({
  orderId:         { type: String, required: true, unique: true },
  driverName:      { type: String, required: true },
  driverPhone:     { type: String, required: true },
  status: {
    type: String,
    enum: ['assigned', 'picked_up', 'on_the_way', 'delivered'],
    default: 'assigned',
  },
  estimatedMinutes: { type: Number, required: true },
  currentLocation:  { type: String, default: 'Restaurant' },
  deliveredAt:      { type: Date, default: null },
}, { timestamps: true });

const Delivery = mongoose.model('Delivery', deliverySchema);

// ── Swagger Setup ──────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Delivery Service API', version: '1.0.0', description: 'Manages deliveries for Food Delivery App' },
    servers: [{ url: 'http://localhost:3004' }],
  },
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Root & Health Routes ───────────────────────────────────────────


app.get('/health', (req, res) => {
  res.json({ status: 'UP', time: new Date().toISOString() });
});

// ── Delivery CRUD Routes ───────────────────────────────────────────

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all deliveries
 *     tags: [Deliveries]
 *     responses:
 *       200:
 *         description: List of all deliveries
 */
app.get('/', async (req, res) => {
  try {
    const deliveries = await Delivery.find().sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /deliveries/{id}:
 *   get:
 *     summary: Get delivery by ID
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Delivery found
 *       404:
 *         description: Delivery not found
 */
app.get('/deliveries/:id', async (req, res) => {
  try {
    const d = await Delivery.findById(req.params.id);
    if (!d) return res.status(404).json({ message: 'Delivery not found' });
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /deliveries/order/{orderId}:
 *   get:
 *     summary: Track delivery by Order ID
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Delivery tracking info
 *       404:
 *         description: No delivery found for this order
 */
app.get('/deliveries/order/:orderId', async (req, res) => {
  try {
    const d = await Delivery.findOne({ orderId: req.params.orderId });
    if (!d) return res.status(404).json({ message: 'No delivery found for this order' });
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /deliveries:
 *   post:
 *     summary: Assign a new delivery
 *     tags: [Deliveries]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, driverName, driverPhone, estimatedMinutes, currentLocation]
 *             properties:
 *               orderId:          { type: string, example: "65f1a2b3c4d5e6f7a8b9c0d3" }
 *               driverName:       { type: string, example: "Nuwan Jayasuriya" }
 *               driverPhone:      { type: string, example: "0712223344" }
 *               estimatedMinutes: { type: integer, example: 25 }
 *               currentLocation:  { type: string, example: "Colombo 06" }
 *     responses:
 *       201:
 *         description: Delivery assigned
 */
app.post('/deliveries', async (req, res) => {
  try {
    const delivery = new Delivery(req.body);
    const saved = await delivery.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /deliveries/{id}/status:
 *   patch:
 *     summary: Update delivery status and location
 *     tags: [Deliveries]
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
 *                 enum: [assigned, picked_up, on_the_way, delivered]
 *                 example: on_the_way
 *               currentLocation: { type: string, example: "Colombo 04" }
 *     responses:
 *       200:
 *         description: Delivery status updated
 */
app.patch('/deliveries/:id/status', async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.body.status === 'delivered') update.deliveredAt = new Date();
    const d = await Delivery.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!d) return res.status(404).json({ message: 'Delivery not found' });
    res.json(d);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /deliveries/{id}:
 *   delete:
 *     summary: Delete a delivery record
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Delivery deleted
 */
app.delete('/deliveries/:id', async (req, res) => {
  try {
    const d = await Delivery.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ message: 'Delivery not found' });
    res.json({ message: 'Delivery deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 404 Fallback ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(` Delivery Service running on http://localhost:${PORT}`);
  console.log(` Swagger: http://localhost:${PORT}/api-docs`);
});