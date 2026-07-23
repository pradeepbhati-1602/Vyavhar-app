const express = require('express');
const router = express.Router();
const { prisma } = require('../prisma');
const { requireSuperAdmin } = require('../middleware/tenantIsolation');

router.use(requireSuperAdmin);

// 1. Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.planTemplate.findMany({
      orderBy: { created_at: 'asc' }
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create new template
router.post('/', async (req, res) => {
  try {
    const newTemplate = await prisma.planTemplate.create({
      data: req.body
    });
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Update template
router.put('/:id', async (req, res) => {
  try {
    const updated = await prisma.planTemplate.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Delete template
router.delete('/:id', async (req, res) => {
  try {
    await prisma.planTemplate.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
