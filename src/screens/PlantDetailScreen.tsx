import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    StatusBar,
    TouchableOpacity,
    Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
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

type UndoAction = {
    type: "water";
    previousPlant: Plant;
    timestamp: Date;
};

export default function PlantDetailScreen({ route, navigation }: any) {
    const { plantId } = route.params;
    const [plant, setPlant] = useState<Plant | null>(null);
    const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadPlant();
        }, [plantId]),
    );

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

        // Store the previous state for undo
        const previousPlant = { ...plant };

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

        // Set undo action
        setUndoAction({
            type: "water",
            previousPlant,
            timestamp: now,
        });

        await loadPlant();
    };

    const handleUndo = async () => {
        if (!undoAction || undoAction.type !== "water") return;

        // Restore previous plant state
        await storageService.updatePlant(undoAction.previousPlant);

        // Remove the last watering event
        const history = await storageService.getWateringHistory();
        const filteredHistory = history.filter(
            (event) => event.plantId !== plantId || event.date !== undoAction.timestamp.toISOString()
        );
        await storageService.setWateringHistory(filteredHistory);

        // Clear undo action
        setUndoAction(null);

        await loadPlant();
    };

    const handleUpdateLastWatered = async (newDate: Date) => {
        if (!plant) return;

        const updatedPlant: Plant = {
            ...plant,
            lastWatered: newDate.toISOString(),
            nextWatering: addDays(newDate, plant.wateringFrequencyDays).toISOString(),
        };

        await storageService.updatePlant(updatedPlant);
        await loadPlant();
    };

    // Parse notes into sections for better display
    const parseNotes = (notes?: string) => {
        if (!notes) return null;

        const sections: Array<{ title: string; content: string[] }> = [];
        const lines = notes.split("\n");
        let currentSection: { title: string; content: string[] } | null = null;

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip advice sections (photo-dependent)
            if (trimmed.toLowerCase().startsWith("advice")) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = null;
                continue;
            }

            // Check if line is a section title (ends with colon or all caps)
            if (trimmed.endsWith(":") || (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && trimmed.length < 30)) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: trimmed.replace(":", ""),
                    content: [],
                };
            } else if (trimmed && currentSection) {
                currentSection.content.push(trimmed);
            } else if (trimmed && !currentSection) {
                // Content without a section header
                if (sections.length === 0 || sections[sections.length - 1].title !== "Notes") {
                    sections.push({ title: "Notes", content: [trimmed] });
                } else {
                    sections[sections.length - 1].content.push(trimmed);
                }
            }
        }

        if (currentSection && currentSection.content.length > 0) {
            sections.push(currentSection);
        }

        return sections.length > 0 ? sections : null;
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
    const noteSections = parseNotes(plant.notes);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {plant.imageUri && (
                    <Image
                        source={{ uri: plant.imageUri }}
                        style={styles.headerImage}
                    />
                )}

                <View style={styles.content}>
                    <Text style={styles.name}>{plant.name}</Text>
                    {plant.species && (
                        <Text style={styles.species}>{plant.species}</Text>
                    )}

                    {/* Undo button - only shows after action */}
                    {undoAction && (
                        <TouchableOpacity
                            style={styles.undoButton}
                            onPress={handleUndo}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.undoButtonText}>↶ Undo Watering</Text>
                        </TouchableOpacity>
                    )}

                    {/* Watering Card */}
                    <View style={styles.wateringCard}>
                        <Text style={styles.sectionLabel}>WATERING</Text>

                        <View style={styles.wateringInfo}>
                            <View style={styles.wateringRow}>
                                <Text style={styles.wateringLabel}>Next watering</Text>
                                <Text
                                    style={[
                                        styles.wateringValue,
                                        overdue && styles.overdueText,
                                    ]}
                                >
                                    {formatRelativeDate(plant.nextWatering)}
                                </Text>
                            </View>
                            <Text style={styles.wateringSubtext}>
                                {formatDate(plant.nextWatering)}
                            </Text>
                        </View>

                        <View style={styles.waterButtons}>
                            <TouchableOpacity
                                style={styles.waterButtonPrimary}
                                onPress={() => handleWater(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.waterButtonTextPrimary}>
                                    💧 Water Now
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.waterButtonSecondary}
                                onPress={() => handleWater(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.waterButtonTextSecondary}>
                                    Defer (Soil Wet)
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Plant Details */}
                    <View style={styles.detailsCard}>
                        <Text style={styles.sectionLabel}>DETAILS</Text>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Frequency</Text>
                            <Text style={styles.detailValue}>
                                Every {plant.wateringFrequencyDays} days
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Last watered</Text>
                            <TouchableOpacity
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.detailValue}>
                                    {formatDate(plant.lastWatered)} ›
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={new Date(plant.lastWatered)}
                                mode="date"
                                display={Platform.OS === "ios" ? "spinner" : "default"}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(Platform.OS === "ios");
                                    if (selectedDate) {
                                        handleUpdateLastWatered(selectedDate);
                                    }
                                }}
                                maximumDate={new Date()}
                                minimumDate={
                                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                                }
                            />
                        )}

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Added</Text>
                            <Text style={styles.detailValue}>
                                {formatDate(plant.addedDate)}
                            </Text>
                        </View>
                    </View>

                    {/* Care Notes with sections */}
                    {noteSections && (
                        <View style={styles.notesCard}>
                            <Text style={styles.sectionLabel}>CARE NOTES</Text>
                            {noteSections.map((section, index) => (
                                <View key={index} style={styles.aiSection}>
                                    <Text style={styles.aiSectionTitle}>
                                        {section.title}
                                    </Text>
                                    {section.content.map((text, i) => (
                                        <Text key={i} style={styles.aiText}>
                                            {text}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDelete}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.deleteButtonText}>
                            Delete Plant
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    headerImage: {
        width: "100%",
        height: 300,
    },
    content: {
        padding: 20,
        gap: 16,
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
        marginBottom: 8,
    },
    undoButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 8,
    },
    undoButtonText: {
        color: colors.primary,
        fontSize: 15,
        fontWeight: "600",
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 16,
    },
    wateringCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    wateringInfo: {
        marginBottom: 20,
    },
    wateringRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    wateringLabel: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    wateringValue: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.primary,
    },
    overdueText: {
        color: colors.danger,
    },
    wateringSubtext: {
        fontSize: 13,
        color: colors.textTertiary,
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
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
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
        fontSize: 15,
        fontWeight: "600",
    },
    detailsCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    detailLabel: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    detailValue: {
        fontSize: 15,
        color: colors.text,
        fontWeight: "500",
    },
    notesCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
    },
    aiSection: {
        gap: 6,
        paddingTop: 6,
    },
    aiSectionTitle: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    aiText: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    deleteButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.danger,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 8,
    },
    deleteButtonText: {
        color: colors.danger,
        fontSize: 16,
        fontWeight: "600",
    },
});
