
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is required",
        });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is required",
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured");

        return res.status(500).json({
            success: false,
            message: "Authentication service is unavailable",
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );



        if (
            !decoded ||
            !Number.isSafeInteger(Number(decoded.id)) ||
            Number(decoded.id) <= 0
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token",
            });
        }

        req.user = decoded;

        return next();
    } catch (err) {
        if (err.name !== "TokenExpiredError" &&
            err.name !== "JsonWebTokenError" &&
            err.name !== "NotBeforeError") {
            console.error("JWT verification failed:", err.message);
        }

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token",
        });
    }
};

module.exports = verifyToken;
