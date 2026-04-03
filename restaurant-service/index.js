const express = require('express');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
require('dotenv').config();

const app = express();
app.use(express.json());

// ── MongoDB Connection ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/food-delivery-restaurants';
mongoose.connect(MONGO_URI)
  .then(() => console.log(' Restaurant Service connected to MongoDB'))
  .catch(err => console.error(' MongoDB connection error:', err.message));

// ── Restaurant Schema & Model ──────────────────────────────────────
const menuItemSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  price: { type: Number, required: true },
});

const restaurantSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  cuisine:  { type: String, required: true },
  location: { type: String, required: true },
  rating:   { type: Number, default: 0, min: 0, max: 5 },
  isOpen:   { type: Boolean, default: true },
  menu:     [menuItemSchema],
}, { timestamps: true });

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// ── Swagger ────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Restaurant Service API', version: '1.0.0', description: 'Manages restaurants for Food Delivery App' },
    servers: [{ url: 'http://localhost:3002' }],
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
 *     summary: Get all restaurants
 *     tags: [Restaurants]
 *     responses:
 *       200:
 *         description: List of all restaurants
 */
app.get('/', async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /restaurants/{id}:
 *   get:
 *     summary: Get restaurant by ID
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Restaurant found
 *       404:
 *         description: Restaurant not found
 */
app.get('/restaurants/:id', async (req, res) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /restaurants:
 *   post:
 *     summary: Add a new restaurant
 *     tags: [Restaurants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, cuisine, location]
 *             properties:
 *               name:     { type: string, example: Rice & Curry Palace }
 *               cuisine:  { type: string, example: Sri Lankan }
 *               location: { type: string, example: Colombo 05 }
 *               rating:   { type: number, example: 4.5 }
 *               isOpen:   { type: boolean, example: true }
 *               menu:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:  { type: string, example: Rice & Curry }
 *                     price: { type: number, example: 450 }
 *     responses:
 *       201:
 *         description: Restaurant added
 */
app.post('/restaurants', async (req, res) => {
  try {
    const restaurant = new Restaurant(req.body);
    const saved = await restaurant.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /restaurants/{id}:
 *   put:
 *     summary: Update restaurant details
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isOpen:   { type: boolean }
 *               rating:   { type: number }
 *               location: { type: string }
 *     responses:
 *       200:
 *         description: Restaurant updated
 */
app.put('/restaurants/:id', async (req, res) => {
  try {
    const r = await Restaurant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(r);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /restaurants/{id}:
 *   delete:
 *     summary: Delete a restaurant
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Restaurant deleted
 */
app.delete('/restaurants/:id', async (req, res) => {
  try {
    const r = await Restaurant.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ message: 'Restaurant not found' });
    res.json({ message: 'Restaurant deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 404 Fallback ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(` Restaurant Service running on http://localhost:${PORT}`);
  console.log(` Swagger: http://localhost:${PORT}/api-docs`);
});
