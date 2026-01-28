import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { Plant } from "../types/plant";

// Check if we're running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

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
            // Skip notifications in Expo Go - they don't work properly
            if (isExpoGo) {
                console.log("Skipping notification scheduling in Expo Go");
                return null;
            }

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

            // Calculate seconds until notification
            const secondsUntilNotification = Math.floor(
                (notificationDate.getTime() - now.getTime()) / 1000
            );

            const trigger: Notifications.NotificationTriggerInput = {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: secondsUntilNotification,
                channelId: Platform.OS === "android" ? "watering" : undefined,
            };

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

            console.log(`Scheduled notification for ${plant.name} in ${secondsUntilNotification}s`);
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
