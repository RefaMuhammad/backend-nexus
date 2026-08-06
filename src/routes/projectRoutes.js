const express = require("express");
const router = express.Router();
const {
  createProject,
  getProjects,
  softDeleteProject,
  updateProject,
} = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createProject);
router.get("/", protect, getProjects);
router.put("/:id", protect, updateProject);
router.delete("/:id", protect, softDeleteProject);

module.exports = router;
