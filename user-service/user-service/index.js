const express = require('express');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
require('dotenv').config();

const app = express();
app.use(express.json());

// ── MongoDB Connection ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/food-delivery-users';
mongoose.connect(MONGO_URI)
  .then(() => console.log(' User Service connected to MongoDB'))
  .catch(err => console.error(' MongoDB connection error:', err.message));

// ── User Schema & Model ────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  email:   { type: String, required: true, unique: true },
  phone:   { type: String, required: true },
  address: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ── Swagger Setup ──────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'User Service API', version: '1.0.0', description: 'Manages users for Food Delivery App' },
    servers: [{ url: 'http://localhost:3001' }],
  },
  apis: ['./index.js'], // Swagger will scan this file for annotations
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

// Serve swagger spec as JSON
app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Root & Health Routes ───────────────────────────────────────────


app.get('/health', (req, res) => {
  res.json({ status: 'UP', time: new Date().toISOString() });
});

// ── User CRUD Routes ────────────────────────────────────────────────

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of all users
 */
app.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, address]
 *             properties:
 *               name:    { type: string, example: Alice Perera }
 *               email:   { type: string, example: alice@example.com }
 *               phone:   { type: string, example: '0771234567' }
 *               address: { type: string, example: Colombo 03 }
 *     responses:
 *       201:
 *         description: User created
 */
app.post('/users', async (req, res) => {
  try {
    const user = new User(req.body);
    const saved = await user.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
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
 *               name:    { type: string }
 *               phone:   { type: string }
 *               address: { type: string }
 *     responses:
 *       200:
 *         description: User updated
 */
app.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(` User Service running on http://localhost:${PORT}`);
  console.log(` Swagger: http://localhost:${PORT}/api-docs`);
});