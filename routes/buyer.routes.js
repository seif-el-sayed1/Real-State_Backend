const express = require("express");

const { BUYER } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Classes
const BuyerController = require("../controllers/buyer.controller");
const UserValidator = require("../validators/buyer.validator");
// Router
const router = express.Router();

// User Routes
router
    .route("/me")
    .get(
        protect,
        allowedTo(BUYER),
        BuyerController.getMyProfile
    ).patch(
        protect,
        allowedTo(BUYER),
        UserValidator.validateUpdateUser,
        BuyerController.updateMyProfile
    )

router
    .route("/lang")
    .patch(
        protect,
        allowedTo(BUYER),
        UserValidator.validateLanguageUpdate,
        BuyerController.updateLang
    );
    
module.exports = router;