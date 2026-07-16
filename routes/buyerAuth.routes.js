const express = require("express");

const { USER } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");
// const FirebaseController = require("../controllers/firebase.controller");
const upload = require("../middlewares/upload.middleware");
// Classes
const BuyerAuthController = require("../controllers/buyerAuth.controller");
// const UserResetPasswordController = require("../controllers/userResetPassword.controllers");
const FirebaseController = require("../controllers/firebase.controller");
const UserValidator = require("../validators/buyer.validator");
const GlobalValidator = require("../validators/global.validator");

// Router
const router = express.Router();

// Auth Routes
router.route("/register").post(
  FirebaseController.uploadSingleImage("Buyers","profilePicture"),
  UserValidator.validateRegisterUser,
  BuyerAuthController.buyerRegister
);

router.route("/login").post(GlobalValidator.validateLogin, BuyerAuthController.buyerLogin);

router.route("/verify-account").post(BuyerAuthController.buyerVerifyAccount);

router.patch(
  "/change-password",
  protect,
  allowedTo(USER),
  GlobalValidator.validateChangePassword,
  BuyerAuthController.updateLoggedBuyerPassword
);

router.post("/verify-otp", BuyerAuthController.verifyOtp);
router.post("/send-otp", GlobalValidator.sendOtpValidator, BuyerAuthController.sendOtp);
router.post("/log-out", protect, allowedTo(USER), BuyerAuthController.logOut);

module.exports = router;
