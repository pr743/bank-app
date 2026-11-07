const { getNotificationsByUserId, markNotificationAsRead } = require("../models/notification");




const getMyNotifications = async (req, res) => {
    try {
        const user_id = req.user.id;

        const notifications = await getNotificationsByUserId(user_id);

        res.status(200).json({
            message: "Notifications fetched successfully",
            data: notifications
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message:
                "Error fetching notifications",

            error:
                error.message
        });
    }
};



const readNotification = async (req, res) => {
    try {
        const user_id = req.user.id;

        const { id } = req.params;

        await markNotificationAsRead(id, user_id);

        res.status(200).json({
            message:
                "Notification marked as read"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message:
                "Error updating notification",

            error:
                error.message
        });

    }
};


module.exports = {
    getMyNotifications,
    readNotification
}