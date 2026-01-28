import * as Location from "expo-location";

export interface UserLocation {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    timezone?: string;
    season: string;
}

export const locationService = {
    async getUserLocation(): Promise<UserLocation | null> {
        try {
            const { status } =
                await Location.requestForegroundPermissionsAsync();

            if (status !== "granted") {
                console.warn("Location permission not granted, using defaults");
                return this.getDefaultLocation();
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Low,
            });

            const [geocode] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            const season = this.getSeason(location.coords.latitude);

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                city: geocode?.city,
                country: geocode?.country,
                timezone: geocode?.timezone,
                season,
            };
        } catch (error) {
            console.error("Failed to get location:", error);
            return this.getDefaultLocation();
        }
    },

    getSeason(latitude: number): string {
        const month = new Date().getMonth(); // 0-11
        const isNorthern = latitude >= 0;

        if (isNorthern) {
            if (month >= 2 && month <= 4) return "spring";
            if (month >= 5 && month <= 7) return "summer";
            if (month >= 8 && month <= 10) return "fall";
            return "winter";
        } else {
            // Southern hemisphere - seasons are opposite
            if (month >= 2 && month <= 4) return "fall";
            if (month >= 5 && month <= 7) return "winter";
            if (month >= 8 && month <= 10) return "spring";
            return "summer";
        }
    },

    getDefaultLocation(): UserLocation {
        return {
            latitude: 52.52, // Berlin
            longitude: 13.405,
            city: "Unknown",
            country: "Unknown",
            season: "unknown",
        };
    },

    getLocationString(location: UserLocation | null): string {
        if (!location) return "Location unknown";
        const parts = [];
        if (location.city) parts.push(location.city);
        if (location.country) parts.push(location.country);
        if (parts.length === 0) return `${location.season} season`;
        return `${parts.join(", ")} (${location.season})`;
    },
};
