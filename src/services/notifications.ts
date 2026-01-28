import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { Plant } from "../types/plant";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export const notificationService = {
    async requestPermissions(): Promise<boolean> {
        if (!Device.isDevice) {
            console.log("Notifications only work on physical devices");
            return false;
        }

        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            console.log("Failed to get notification permissions");
            return false;
        }

        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("watering", {
                name: "Watering Reminders",
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#00ff88",
            });
        }

        return true;
    },

    async scheduleWateringNotification(plant: Plant): Promise<string | null> {
        try {
            // Cancel existing notification for this plant
            await this.cancelPlantNotifications(plant.id);

            const nextWateringDate = new Date(plant.nextWatering);
            const now = new Date();

            // Only schedule if the date is in the future
            if (nextWateringDate <= now) {
                return null;
            }

            // Schedule notification for 9 AM on the watering day
            const notificationDate = new Date(nextWateringDate);
            notificationDate.setHours(9, 0, 0, 0);

            const trigger = new Date(notificationDate);

            const notificationId =
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "💧 Time to water!",
                        body: `${plant.name} needs watering today`,
                        data: { plantId: plant.id },
                        sound: true,
                        priority:
                            Notifications.AndroidNotificationPriority.HIGH,
                    },
                    trigger,
                });

            return notificationId;
        } catch (error) {
            console.error("Failed to schedule notification:", error);
            return null;
        }
    },

    async cancelPlantNotifications(plantId: string): Promise<void> {
        try {
            const scheduledNotifications =
                await Notifications.getAllScheduledNotificationsAsync();

            for (const notification of scheduledNotifications) {
                if (notification.content.data?.plantId === plantId) {
                    await Notifications.cancelScheduledNotificationAsync(
                        notification.identifier,
                    );
                }
            }
        } catch (error) {
            console.error("Failed to cancel notifications:", error);
        }
    },

    async rescheduleAllNotifications(plants: Plant[]): Promise<void> {
        // Cancel all existing notifications
        await Notifications.cancelAllScheduledNotificationsAsync();

        // Schedule new notifications for all plants
        for (const plant of plants) {
            await this.scheduleWateringNotification(plant);
        }
    },

    async getBadgeCount(): Promise<number> {
        return await Notifications.getBadgeCountAsync();
    },

    async setBadgeCount(count: number): Promise<void> {
        await Notifications.setBadgeCountAsync(count);
    },

    async clearBadge(): Promise<void> {
        await Notifications.setBadgeCountAsync(0);
    },
};
