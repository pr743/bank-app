const {
    findUserByUpiId,
    searchUserByName
} = require("../models/user");



const getProfile = (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    return res.status(200).json({
        message: "Profile fetched successfully",
        user: {
            id: req.user.id,
            full_name: req.user.full_name,
            upi_id: req.user.upi_id
        }
    });
};



const getUserByUPi = async (req, res) => {
    try {
        const upiId = String(req.params.upiId || "").trim();

        if (!upiId || upiId.length > 100) {
            return res.status(400).json({
                message: "Valid UPI ID is required"
            });
        }

        const users = await findUserByUpiId(upiId);

        if (!users || users.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const user = users[0];

        return res.status(200).json({
            id: user.id,
            full_name: user.full_name,
            upi_id: user.upi_id
        });

    } catch (error) {
        console.error("Get User By UPI Error:", error);

        return res.status(500).json({
            message: "Unable to fetch user"
        });
    }
};



const searchUser = async (req, res) => {
    try {
        const name = req.query.name;

        if (typeof name !== "string") {
            return res.status(400).json({
                message: "Name is required"
            });
        }

        const searchName = name.trim();

        if (searchName.length < 2) {
            return res.status(400).json({
                message: "Enter at least 2 characters"
            });
        }

        if (searchName.length > 50) {
            return res.status(400).json({
                message: "Search name is too long"
            });
        }

        const users = await searchUserByName(searchName);


        const safeUsers = (users || [])
            .slice(0, 10)
            .map(user => ({
                id: user.id,
                full_name: user.full_name,
                upi_id: user.upi_id
            }));

        return res.status(200).json(safeUsers);

    } catch (error) {
        console.error("Search User Error:", error);

        return res.status(500).json({
            message: "Unable to search users"
        });
    }
};




module.exports = {
    getProfile,
    getUserByUPi,
    searchUser
};