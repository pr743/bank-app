
const express = require("express");
const verifyToken = require("../middlewares/auth");

const {
    addBeneficiary,
    getMyBeneficiaries,
    removeBeneficiary,
    verifyBeneficiaryAccount,
} = require("../controllers/beneficiaryController");

const router = express.Router();


router.use(verifyToken);

router.post("/add", addBeneficiary);
router.get("/verify/:account_number", verifyBeneficiaryAccount);
router.get("/", getMyBeneficiaries);
router.delete("/:id", removeBeneficiary);

module.exports = router;
