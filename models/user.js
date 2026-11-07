const db = require("../config/db");


const createUser = async (
    full_name,
    email,
    password,
    upi_id
) => {
    const name = String(full_name || "").trim();
    const userEmail = String(email || "").trim().toLowerCase();
    const userUpi = String(upi_id || "").trim();

    if (!name || !userEmail || !password || !userUpi) {
        throw new Error("All user fields are required");
    }

    const query = `
        INSERT INTO users (
            full_name,
            email,
            password,
            upi_id
        )
        VALUES (?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
        name,
        userEmail,
        password,
        userUpi
    ]);

    return result;
};



const findUserByEmail = async (email) => {
    const userEmail = String(email || "").trim().toLowerCase();

    if (!userEmail) {
        return [];
    }

    const query = `
        SELECT
            id,
            full_name,
            email,
            password,
            upi_id,
            role
        FROM users
        WHERE email = ?
        LIMIT 1
    `;

    const [rows] = await db.query(query, [userEmail]);

    return rows;
};


const findUserByUpiId = async (upi_id) => {
    const userUpi = String(upi_id || "").trim();

    if (!userUpi) {
        return [];
    }

    const query = `
        SELECT
            id,
            full_name,
            upi_id
        FROM users
        WHERE upi_id = ?
        LIMIT 1
    `;

    const [rows] = await db.query(query, [userUpi]);

    return rows;
};


const searchUserByName = async (name) => {
    const searchName = String(name || "").trim();

    if (searchName.length < 2 || searchName.length > 50) {
        return [];
    }

    const query = `
        SELECT
            id,
            full_name,
            upi_id
        FROM users
        WHERE full_name LIKE ?
        ORDER BY full_name ASC
        LIMIT 10
    `;

    const [rows] = await db.query(query, [
        `%${searchName}%`
    ]);

    return rows;
};


module.exports = {
    createUser,
    findUserByEmail,
    findUserByUpiId,
    searchUserByName
};