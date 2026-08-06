const express = require('express');
const router = express.Router();
const { createProject, getProjects, softDeleteProject, updateProject } = require('../controllers/projectController');

router.post('/', createProject);
router.get('/', getProjects);
router.put('/:id', updateProject);
router.delete('/:id', softDeleteProject);

module.exports = router;