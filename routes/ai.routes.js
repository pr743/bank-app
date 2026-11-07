const express = require("express");
const verifyToken = require("../middlewares/auth");
const { chatWithAI } = require("../controllers/ai.controller");



const router = express.Router();


router.use(verifyToken);

router.post("/chat", chatWithAI);

module.exports = router;