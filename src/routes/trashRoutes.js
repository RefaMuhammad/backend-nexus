const express = require("express");
const router = express.Router();
const trashController = require("../controllers/trashController");
const { protect } = require("../middleware/authMiddleware");

// All trash routes require authentication
router.use(protect);

router.get("/", trashController.viewTrash);
router.patch("/restore", trashController.restoreTrash);
router.delete("/permanent", trashController.permanentDeleteTrash);

module.exports = router;
