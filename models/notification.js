
const db = require("../config/db");

const validateId = (id, fieldName) => {
    const value = Number(id);

    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Invalid ${fieldName}`);
    }

    return value;
};


const createNotification = async (user_id, message) => {
    const userId = validateId(user_id, "user ID");

    if (typeof message !== "string" || !message.trim()) {
        throw new Error("Notification message is required");
    }

    const [result] = await db.query(
        `INSERT INTO notifications (user_id, message)
         VALUES (?, ?)`,
        [userId, message.trim()]
    );

    return result;
};


const getNotificationsByUserId = async (user_id) => {
    const userId = validateId(user_id, "user ID");

    const [rows] = await db.query(
        `SELECT id, user_id, message, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC`,
        [userId]
    );

    return rows;
};


const markNotificationAsRead = async (id, user_id) => {
    const notificationId = validateId(id, "notification ID");
    const userId = validateId(user_id, "user ID");

    const [result] = await db.query(
        `UPDATE notifications
         SET is_read = 1
         WHERE id = ?
         AND user_id = ?`,
        [notificationId, userId]
    );

    return result;
};


module.exports = {
    createNotification,
    getNotificationsByUserId,
    markNotificationAsRead
};
