const express = require("express");
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  moveToTrash,
  restoreProject,
  deleteProject,
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.patch('/:id/trash', moveToTrash);
router.patch('/:id/restore', restoreProject);
router.delete('/:id', deleteProject);

module.exports = router;
