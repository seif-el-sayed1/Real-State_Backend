const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const prisma = require("../startup/db");
const Auth = require("../utils/auth");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const { generateCode, hashCode } = require("../utils/generateCode");
// Controller classes
const { userVerificationEmail } = require("./email.controller");
const EmailController = require("./email.controller");

class BuyerAuthController {
  #getBuyerData = (user, lang = "en") => {
    return {
      _id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profilePicture: user.profilePicture,
      email: user.email,
      phone: user.phone,
      age: user.age,
      gender: user.gender,
      createdAt: user.createdAt,
      loginType: user.loginType,
      budgetMin: user.budgetMin,
      budgetMax: user.budgetMax,
      preferredAreas: user.preferredAreas,
      searchHistory: user.searchHistory,
      deals: user.deals,
    };
  };

  login = (user, loginType) =>
    asyncHandler(async (req, res, next) => {
      const { password, email } = req.body;
      const lang = req.headers.lang || "en";


      if (loginType && loginType !== user.loginType)
        return next(new ApiError(translate("Incorrect Email or password", lang), 403));
      else if (!loginType) {
        if (!(await Auth.comparePassword(user, password)))
          return next(new ApiError(translate("Incorrect Email or password", lang), 403));
      }

      // Response Msg
      let message = `Welcome back ${user.firstName || ""}!`;

      // Check if user account is deactivated
      if (!user.isActive) {
        const targetDate = new Date(user.deactivatedAt);
        const currentDate = new Date();
        const timeDifference = currentDate - targetDate;
        const millisecondsIn15Days = 15 * 24 * 60 * 60 * 1000;

        if (timeDifference >= millisecondsIn15Days) {
          return next(new ApiError(translate("Incorrect Email or password", lang), 404));
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              deactivatedAt: null,
              isActive: true
            }
          });
          message = "Welcome back! Your account has been reactivated.";
        }
      }

      // Check if account is verified
      if (!user.isVerified) {
        const { code, hashedCode } = await generateCode();
        const verifiedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            verificationCode: hashedCode,
            verificationCodeExp: new Date(Date.now() + 10 * 60 * 1000)
          },
        });

        if (user.email) {
          await userVerificationEmail(code, user.email);

          return res.status(200).json({
            success: true,
            message: "Verification OTP is sent to your Email",
            data: {
              ...this.#getBuyerData(user, lang)
            }
          });
        }
      }


      if (user.isBlocked)
        return next(
          new ApiError(
            translate("Your account is blocked, please contact the support team", lang),
            403
          )
        );

      // generate token
      const token = await Auth.generateToken(user.id, user.role);

      // Save notification token
      if (req.body.notificationToken) {
        await prisma.user.update({
          where: { id: user.id },
          data: { notificationToken: req.body.notificationToken }
        });
      }

      // Remove password from the response
      user.password = undefined;
      user.isVerified = undefined;
      user.isActive = undefined;

      // response
      res.status(200).json({
        success: true,
        message,
        data: {
          ...this.#getBuyerData(user, lang),
          ...token
        }
      });
    });


  // @desc    Log In
  // @route   POST /buyer/auth/login
  // @access  Public
  buyerLogin = asyncHandler(async (req, res, next) => {
    const { email, password, loginType, phone } = req.body;
    const lang = req.headers.lang || "en";

    const buyer = await prisma.buyer.findFirst({
      where: phone ? { phone } : { email }
    });

    if (loginType) {
      if (!buyer) {
        return res.status(200).json({
          success: true,
          message: "Please, Complete your profile!",
          signUpForFirstTime: true
        });
      }

      return this.login(buyer, loginType)(req, res, next);
    }

    if (!buyer) {
      return next(new ApiError(translate("Incorrect Email or password", lang), 403));
    }

    return this.login(buyer, loginType)(req, res, next);
  });

  // @desc    Sign Up
  // @route   POST /buyer/auth/register
  // @access  Public
  buyerRegister = async (req, res, next) => {
    try {

      console.log(" 🚀~ Req.body ~ in Buyer register", req.body);

      const { code, hashedCode } = await generateCode();

      // create user
      const user = await prisma.buyer.create({
        data: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          gender: req.body.gender,
          email: req.body.email,
          phone: req.body.phone,
          age: Number.parseInt(req.body.age) || req.body.age,
          profilePicture: req.body.image || req.body.profilePicture,
          loginType: req.body.loginType,
          notificationToken: req.body.notificationToken,
          password: await Auth.hashPassword(req.body.password),
          verificationCode: hashedCode,
          verificationCodeExp: new Date(Date.now() + 10 * 60 * 1000)
        }
      })

      const { email, loginType } = req.body;

      // For non-email login types, mark as verified immediately
      if (loginType && loginType !== "email") {

        const verifiedUser = await prisma.buyer.update({
          where: {
            id: user.id
          },
          data: {
            isVerified: true
          }
        });
        const token = await Auth.generateToken(verifiedUser.id, verifiedUser.role);

        res.status(200).json({
          success: true,
          message: "Account Created and verified successfully",
          data: {
            ...this.#getBuyerData(verifiedUser, req.headers.lang),
            ...token
          }
        });
      } else if (email) {
        // Send verification email only
        await userVerificationEmail(code, email);

        res.status(200).json({
          success: true,
          message: "Verification OTP is sent to your Email",
          data: {
            ...this.#getBuyerData(user, req.headers.lang)
          }
        });
      }
    } catch (err) {
      next(err);
    }
  };

  // @desc    Buyer account verification
  // @route   POST /buyer/auth/verifyAccount
  // @access  Public
  buyerVerifyAccount = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";

    if (!req.body.code)
      return next(new ApiError(translate("Verification OTP is required", lang), 400));

    const hashedCode = crypto.createHash("sha256").update(req.body.code).digest("hex");

    const buyer = await prisma.buyer.findUnique({ where: { email: req.body.email } });
    if (!buyer || (!buyer.verificationCode && !buyer.verificationCodeExp))
      return next(new ApiError(translate("Invalid request", lang), 400));

    if (Date.now() >= Date.parse(buyer.verificationCodeExp))
      return next(new ApiError(translate("Verification OTP is expired", lang), 401));

    if (buyer.verificationCode !== hashedCode)
      return next(new ApiError(translate("Invalid Verification OTP", lang), 401));

    const updatedBuyer = await prisma.buyer.update({
      where: { email: req.body.email },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationCodeExp: null,
        notificationToken: req.body.notificationToken
      },
    });

    const token = await Auth.generateToken(updatedBuyer.id, updatedBuyer.role);

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        ...this.#getBuyerData(updatedBuyer, lang),
        ...token
      }
    });
  });


  // // @desc    Update logged buyer password
  // // @route   PATCH /buyer/auth/updatePassword
  // // @access  Private
  updateLoggedBuyerPassword = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";

    if (!(await Auth.comparePassword(req.user, req.body.currentPassword)))
      return next(new ApiError(translate("Incorrect password", lang), 401));

    const buyer = await prisma.buyer.update({
      where: { id: req.user.id },
      data: {
        password: await Auth.hashPassword(req.body.newPassword),
        passwordChangedAt: new Date()
      }
    });

    if (!buyer) return next(new ApiError("Buyer not found", 404));

    res.status(200).json({
      success: true,
      message: "Password updated successfully, please login again"
    });
  });

  //@desc  Verify OTP
  //@route POST /buyer/auth/verify-otp
  //@access Private
  verifyOtp = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";

    const hashedCode = hashCode(req.body.otp);
    const buyer = await prisma.buyer.findFirst(
      {
        where: {
          verificationCode: hashedCode,
          verificationCodeExp: { gt: new Date() }
        }
      }
    );

    if (!buyer)
      return next(new ApiError(translate("OTP isn't found!", lang), 403));

    let token = { token: buyer.token, tokenExpDate: buyer.tokenExpDate };

    if (!token.token) token = await Auth.generateToken(buyer.id, buyer.role);

    await prisma.buyer.update({
      where: { id: buyer.id },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationCodeExp: null,
        phone: buyer.phone || undefined,
        email: buyer.email || undefined,
      }
    });

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        ...this.#getBuyerData(buyer, lang),
        ...token
      }
    });
  });

  //@desc  Send OTP
  //@route POST /buyer/auth/send-otp
  //@access Private
  sendOtp = asyncHandler(async (req, res, next) => {
    let { email } = req.body;
    const lang = req.headers.lang || "en";

    const buyer = await prisma.buyer.findFirst({
      where: {
        AND: [{ isVerified: false }, { email }]
      }
    });

    if (!buyer) return next(new ApiError(translate("Buyer Not Found!", lang), 404));

    const { code, hashedCode } = await generateCode();

    await prisma.buyer.update({
      where: { id: buyer.id },
      data: {
        verificationCode: hashedCode,
        verificationCodeExp: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    if (email) {
      await EmailController.userVerificationEmail(code, email);
      return res.status(200).json({
        success: true,
        message: "Verification OTP is sent to your Email"
      });
    }

  });

  //@desc  Log Out
  //@route POST /buyer/auth/log-out
  //@access Private
  logOut = asyncHandler(async (req, res, next) => {
    const buyer = req.buyer;
    await prisma.buyer.update({
      where: { id: buyer.id },
      data: {
        notificationToken: null,
        token: null,
        tokenExpDate: null
      }
    });

    res.status(200).json({
      success: true,
      message: "Buyer logged out successfully!"
    });
  });
}

module.exports = new BuyerAuthController();
