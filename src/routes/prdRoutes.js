const express = require("express");
const router = express.Router();
const prdController = require("../controllers/prdController");
const { protect } = require("../middleware/authMiddleware");

// All PRD endpoints require authentication
router.use(protect);

router.post("/", prdController.createPRD);
router.get("/", prdController.getPRDs);
router.get("/project/:projectId", prdController.getPRDsByProject);
router.get("/:id", prdController.getPRDById);
router.put("/:id", prdController.updatePRD);
router.patch("/:id/trash", prdController.moveToTrash);
router.patch("/:id/restore", prdController.restoreFromTrash);
router.delete("/:id", prdController.deletePRD);

module.exports = router;
