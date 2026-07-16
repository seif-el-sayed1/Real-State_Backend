const asycnHandler = require("express-async-handler");
const prisma = require("../startup/db");
const ApiFeatures = require("../utils/ApiFeatures");

class BuyerController {
    // @desc    Get my profile
    // @route   GET /api/v1/buyers/me
    // @access  Private (Buyer)
    getMyProfile = asycnHandler(async (req, res) => {
        const buyer = await prisma.buyer.findUnique({
            where: {
                id: req.user.id,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                profilePicture: true,
                age: true,
                lang: true
            }
        });
        res.status(200).json({
            success: true,
            data: buyer,
        });
    });

    // @desc    Update my profile
    // @route   PATCH /api/v1/buyers/me
    // @access  Private (Buyer)
    updateMyProfile = asycnHandler(async (req, res) => {
        const { firstName, lastName, phone, age } = req.body;
        const buyer = await prisma.buyer.update({
            where: {
                id: req.user.id,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                profilePicture: true,
                age: true,
                lang: true
            },
            data: {
                firstName,
                lastName,
                phone,
                age: parseInt(age)
            }
        });
        res.status(200).json({
            success: true,
            data: buyer,
        });
    });

    // @desc    Update my language
    // @route   PATCH /api/v1/buyers/lang
    // @access  Private (Buyer)
    updateLang = asycnHandler(async (req, res) => {
        const { lang } = req.body;
        const buyer = await prisma.buyer.update({
            where: {
                id: req.user.id,
            },
            select: {
                id: true,
                lang: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                profilePicture: true,
                age: true,
            },
            data: {
                lang
            }
        });
        res.status(200).json({
            success: true,
            data: buyer,
        });
    });
    
}

module.exports = new BuyerController();