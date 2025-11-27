const express = require("express");
const { handleGetModels, handleGetTextModels, handleGetImageModels, handleGetModel } = require("../controllers/modelsController");




const router = express.Router();


router.get("/", handleGetModels)
router.get("/text", handleGetTextModels)
router.get("/image", handleGetImageModels)
router.get("/:slug", handleGetModel)






module.exports = router;