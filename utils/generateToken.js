const jwt = require("jsonwebtoken");

const generateToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    if (!user || !user.id || !user.email || !user.role) {
        throw new Error("Valid user details are required to generate a token");
    }

    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
            algorithm: "HS256",
        }
    );
};

module.exports = generateToken;
