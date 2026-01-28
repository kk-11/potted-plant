import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    StatusBar,
} from "react-native";
import { MotiView } from "moti";
import { Plant } from "../types/plant";
import { storageService } from "../services/storage";
import {
    formatDate,
    formatRelativeDate,
    addDays,
    isPastDue,
} from "../utils/dateUtils";
import { colors } from "../theme/colors";
import { showAlert } from "../utils/alert";

export default function PlantDetailScreen({ route, navigation }: any) {
    const { plantId } = route.params;
    const [plant, setPlant] = useState<Plant | null>(null);

    useEffect(() => {
        loadPlant();
    }, [plantId]);

    const loadPlant = async () => {
        const plants = await storageService.getPlants();
        const found = plants.find((p) => p.id === plantId);
        if (found) {
            setPlant(found);
        } else {
            navigation.goBack();
        }
    };

    const handleWater = async (soilWasWet: boolean) => {
        if (!plant) return;

        const now = new Date();
        const daysToAdd = soilWasWet
            ? Math.ceil(plant.wateringFrequencyDays / 2)
            : plant.wateringFrequencyDays;

        const updatedPlant: Plant = {
            ...plant,
            lastWatered: now.toISOString(),
            nextWatering: addDays(now, daysToAdd).toISOString(),
        };

        await storageService.updatePlant(updatedPlant);
        await storageService.addWateringEvent({
            plantId: plant.id,
            date: now.toISOString(),
            soilWasWet,
            deferredDays: soilWasWet ? daysToAdd : undefined,
        });

        setPlant(updatedPlant);
    };

    const handleDelete = () => {
        showAlert("Delete plant", `Remove ${plant?.name}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        console.log("Deleting plant:", plantId);
                        await storageService.deletePlant(plantId);
                        console.log("Plant deleted successfully");
                        navigation.navigate("Home");
                    } catch (error) {
                        console.error("Failed to delete plant:", error);
                        showAlert(
                            "Error",
                            "Failed to delete plant. Please try again.",
                        );
                    }
                },
            },
        ]);
    };

    if (!plant) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
            </View>
        );
    }

    const overdue = isPastDue(plant.nextWatering);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView>
                {plant.imageUri && (
                    <Image
                        source={{ uri: plant.imageUri }}
                        style={styles.headerImage}
                    />
                )}

                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: "timing", duration: 400 }}
                    style={styles.content}
                >
                    <Text style={styles.name}>{plant.name}</Text>
                    {plant.species && (
                        <Text style={styles.species}>{plant.species}</Text>
                    )}

                    <View style={styles.wateringCard}>
                        <View style={styles.wateringHeader}>
                            <View>
                                <Text style={styles.nextLabel}>
                                    Next watering
                                </Text>
                                <Text
                                    style={[
                                        styles.nextDate,
                                        overdue && styles.overdueText,
                                    ]}
                                >
                                    {formatRelativeDate(plant.nextWatering)}
                                </Text>
                                <Text style={styles.dateSmall}>
                                    {formatDate(plant.nextWatering)}
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.statusIndicator,
                                    overdue && styles.statusOverdue,
                                ]}
                            />
                        </View>

                        <View style={styles.waterButtons}>
                            <Text style={styles.waterButtonTextPrimary}>
                                Water
                            </Text>

                            <Text style={styles.waterButtonTextSecondary}>
                                Defer
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Frequency</Text>
                            <Text style={styles.infoValue}>
                                Every {plant.wateringFrequencyDays}d
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Last watered</Text>
                            <Text style={styles.infoValue}>
                                {formatDate(plant.lastWatered)}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Added</Text>
                            <Text style={styles.infoValue}>
                                {formatDate(plant.addedDate)}
                            </Text>
                        </View>
                    </View>

                    {plant.notes && (
                        <View style={styles.infoCard}>
                            <Text style={styles.notesLabel}>Notes</Text>
                            <Text style={styles.notes}>{plant.notes}</Text>
                        </View>
                    )}
                    <Text style={styles.deleteButtonText}>Delete Plant</Text>
                </MotiView>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    headerImage: {
        width: "100%",
        height: 300,
    },
    content: {
        padding: 20,
    },
    name: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    species: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 24,
    },
    wateringCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    wateringHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    nextLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
        fontWeight: "600",
    },
    nextDate: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.primary,
        marginBottom: 4,
    },
    overdueText: {
        color: colors.danger,
    },
    dateSmall: {
        fontSize: 14,
        color: colors.textTertiary,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    statusOverdue: {
        backgroundColor: colors.danger,
    },
    waterButtons: {
        flexDirection: "row",
        gap: 12,
    },
    waterButtonPrimary: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    waterButtonSecondary: {
        flex: 1,
        backgroundColor: colors.surfaceLight,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    waterButtonTextPrimary: {
        color: colors.background,
        fontSize: 16,
        fontWeight: "600",
    },
    waterButtonTextSecondary: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "600",
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoLabel: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    infoValue: {
        fontSize: 15,
        color: colors.text,
        fontWeight: "500",
    },
    notesLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 12,
        fontWeight: "600",
    },
    notes: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 22,
    },
    deleteButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.danger,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 8,
        marginBottom: 32,
    },
    deleteButtonText: {
        color: colors.danger,
        fontSize: 16,
        fontWeight: "600",
    },
});
