const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const {
    createUser,
    findUserByEmail,
} = require("../models/user");

const generateToken = require("../utils/generateToken");



const normalizeEmail = (email) =>
    typeof email === "string"
        ? email.trim().toLowerCase()
        : "";



const registerUser = async (req, res) => {
    try {
        const body =
            req.body && typeof req.body === "object"
                ? req.body
                : {};

        const full_name =
            typeof body.full_name === "string"
                ? body.full_name.trim()
                : "";

        const email = normalizeEmail(body.email);
        const password = body.password;


        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, and password are required",
            });
        }


        if (full_name.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Full name is too long",
            });
        }


        if (
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address",
            });
        }


        if (
            typeof password !== "string" ||
            password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 12 characters and no more than 72 UTF-8 bytes",
            });
        }


        const existingUsers = await findUserByEmail(email);

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Unable to register with this email address",
            });
        }


        const hashedPassword = await bcrypt.hash(password, 12);


        const username =
            email.split("@")[0]
                .replace(/[^a-z0-9]/g, "")
                .slice(0, 24) || "user";

        const upi_id =
            `${username}${crypto.randomBytes(6).toString("hex")}@finbank`;


        await createUser(
            full_name,
            email,
            hashedPassword,
            upi_id
        );

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            upi_id,
        });

    } catch (error) {

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Unable to register with this email address",
            });
        }

        console.error(
            "Registration failed:",
            error.code || error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to complete registration",
        });
    }
};



const loginUser = async (req, res) => {
    try {
        const body =
            req.body && typeof req.body === "object"
                ? req.body
                : {};

        const email = normalizeEmail(body.email);
        const password = body.password;

        if (
            !email ||
            email.length > 254 ||
            typeof password !== "string" ||
            !password ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter valid email and password",
            });
        }


        const users = await findUserByEmail(email);

        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const user = users[0];


        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }


        if (!user.id || !user.email || !user.role) {
            console.error(
                "Login failed: required user fields are missing"
            );

            return res.status(500).json({
                success: false,
                message: "Unable to complete login",
            });
        }


        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                upi_id: user.upi_id,
            },
        });

    } catch (error) {
        console.error(
            "Login failed:",
            error.code || error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to complete login",
        });
    }
};




module.exports = {
    registerUser,
    loginUser,
};