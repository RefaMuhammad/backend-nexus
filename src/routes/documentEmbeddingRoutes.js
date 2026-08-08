const express = require("express");
const router = express.Router();
const documentEmbeddingController = require("../controllers/documentEmbeddingController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", documentEmbeddingController.getEmbeddingsByFile);
router.put("/:id", documentEmbeddingController.updateEmbedding);

module.exports = router;
