const express = require("express");

// Constants
const { ADMIN, SUPER_ADMIN } = require("../utils/constants");

// Auth middleware
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Classes
const AdminAuthController = require("../controllers/adminAuth.controller");
const GlobalValidator = require("../validators/global.validator");

// Router
const router = express.Router();

// Auth Routes
router.route("/login").post(GlobalValidator.validateLogin, AdminAuthController.login);

router
  .route("/verify-account")
  .post(
    protect,
    allowedTo(SUPER_ADMIN, ADMIN),
    GlobalValidator.validateNewPassword,
    AdminAuthController.verifyAccount
  );

router
  .route("/reset-password")
  .patch(
    protect,
    allowedTo(SUPER_ADMIN, ADMIN),
    GlobalValidator.validateChangePassword,
    AdminAuthController.adminChangePassword
  );

// Reset Password Routes
router.route("/forget-password").post(AdminAuthController.adminForgotPassword);

router
  .route("/reset-password/:token")
  .patch(GlobalValidator.validateNewPassword, AdminAuthController.adminResetPassword);

module.exports = router;
