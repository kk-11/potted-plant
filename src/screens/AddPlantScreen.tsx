import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    ActivityIndicator,
    StatusBar,
    Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MotiView } from "moti";
import { Plant } from "../types/plant";
import { PlantIdentification } from "../types/plantIdentification";
import { storageService } from "../services/storage";
import { addDays } from "../utils/dateUtils";
import { colors } from "../theme/colors";
import { geminiService } from "../services/gemini";
import { locationService, UserLocation } from "../services/location";
import { showAlert } from "../utils/alert";

export default function AddPlantScreen({ navigation }: any) {
    const [imageUri, setImageUri] = useState<string | undefined>();
    const [identifying, setIdentifying] = useState(false);
    const [identified, setIdentified] = useState(false);
    const [confidence, setConfidence] = useState<number>(0);
    const [debugInfo, setDebugInfo] = useState<string>("");
    const [aiResult, setAiResult] = useState<PlantIdentification | null>(null);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

    const [commonName, setCommonName] = useState("");
    const [name, setName] = useState("");
    const [wateringDays, setWateringDays] = useState("7");
    const [lastWatered, setLastWatered] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [notes, setNotes] = useState("");

    // Get user location on mount
    useEffect(() => {
        locationService.getUserLocation().then(setUserLocation);
    }, []);

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== "granted") {
            showAlert("Permission needed", "Please grant camera permissions");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 1,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setIdentified(false);
            setCommonName("");
            setName("");
            setNotes("");
            setConfidence(0);
            setAiResult(null);
            setLastWatered(new Date());
        }
    };

    const pickImage = async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== "granted") {
            showAlert(
                "Permission needed",
                "Please grant camera roll permissions",
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 1,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setIdentified(false);
            setCommonName("");
            setName("");
            setNotes("");
            setConfidence(0);
            setAiResult(null);
            setLastWatered(new Date());

            handleIdentify(result.assets[0].uri);
        }
    };

    const handleIdentify = async (uri?: string) => {
        const targetUri = uri || imageUri;
        if (!targetUri) return;

        setIdentifying(true);
        setDebugInfo("Analyzing image...");

        try {
            const locationContext = userLocation
                ? {
                      season: userLocation.season,
                      city: userLocation.city,
                      country: userLocation.country,
                  }
                : undefined;

            const result = await geminiService.identifyPlant(
                targetUri,
                locationContext,
            );
            setAiResult(result);
            const confidencePercent = result.identification?.confidence ?? 0;
            setConfidence(confidencePercent);

            // Set debug info to show full raw Gemini response
            setDebugInfo(JSON.stringify(result, null, 2));

            if (!result.identification?.isPlant) {
                showAlert(
                    "Not a plant",
                    "Could not identify a plant. Please take a photo of a live plant.",
                    [{ text: "Retake", onPress: takePhoto }],
                );
                return;
            }

            // Low confidence - show advice and prompt for better photo
            if (confidencePercent < 0.6) {
                let lowConfidenceMessage = `Only ${Math.round(confidencePercent * 100)}% confident.`;

                if (result.notes?.advice) {
                    lowConfidenceMessage += `\n\n${result.notes.advice}`;
                } else if (result.inputAssessment?.improvementSuggestions?.length) {
                    lowConfidenceMessage += `\n\n${result.inputAssessment.improvementSuggestions.join("\n")}`;
                } else {
                    lowConfidenceMessage += `\n\nFor better results:\n• Move closer to the plant\n• Better lighting\n• Focus on leaves clearly\n• Keep image sharp`;
                }

                showAlert("Low confidence", lowConfidenceMessage, [
                    { text: "Retake Photo", onPress: takePhoto },
                    {
                        text: "Continue Anyway",
                        onPress: () => populateForm(result),
                    },
                ]);
                return;
            }

            // Good identification
            populateForm(result);
            setIdentified(true);
        } catch (error) {
            console.error("Identification failed:", error);
            setDebugInfo(`Error: ${error}`);
            showAlert("Error", "Failed to identify plant. Please try again.");
        } finally {
            setIdentifying(false);
        }
    };

    const populateForm = (result: PlantIdentification) => {
        if (result.identification?.commonName) {
            setCommonName(result.identification.commonName);
            // setName(result.commonName); // Default name to common name
        }
        if (typeof result.derivedSummary?.wateringFrequencyDays === "number") {
            setWateringDays(result.derivedSummary.wateringFrequencyDays.toString());
        }

        let careNotes = "";
        if (result.identification?.scientificName) {
            careNotes += `${result.identification.scientificName}\n\n`;
        }
        if (result.derivedSummary?.sunlightNeeds) {
            careNotes += `Sunlight: ${result.derivedSummary.sunlightNeeds}\n`;
        }
        if (result.derivedSummary?.careLevel) {
            careNotes += `Care level: ${result.derivedSummary.careLevel}\n`;
        }
        if (result.notes?.description) {
            careNotes += `\n${result.notes.description}`;
        }
        if (result.notes?.advice) {
            careNotes += `${careNotes ? "\n\n" : ""}${result.notes.advice}`;
        }
        if (careNotes) {
            setNotes(careNotes);
        }
        setIdentified(true);
    };

    const renderAiSummary = () => {
        if (!aiResult) return null;

        const title =
            aiResult.identification?.commonName ||
            aiResult.identification?.scientificName ||
            "Plant";
        const scientificName = aiResult.identification?.scientificName;
        const imageQualityOverall = aiResult.inputAssessment?.imageQuality?.overall;
        const imageQualityConfidence = aiResult.inputAssessment?.imageQuality?.confidence;
        const confidencePercent = aiResult.identification?.confidence ?? 0;
        const wateringFrequencyDays = aiResult.derivedSummary?.wateringFrequencyDays;
        const safeDryMin = aiResult.careProfile?.water?.safeDryPeriodDays?.min;
        const safeDryMax = aiResult.careProfile?.water?.safeDryPeriodDays?.max;
        const moisturePref = aiResult.careProfile?.water?.preferredSoilMoisture;
        const warningTriggers = aiResult.wateringLogicHints?.warningTriggers;
        const advice = aiResult.notes?.advice;

        return (
            <View style={styles.aiCard}>
                <Text style={styles.aiTitle}>{title}</Text>
                {!!scientificName && scientificName !== title && (
                    <Text style={styles.aiSubtitle}>{scientificName}</Text>
                )}

                <View style={styles.aiRow}>
                    <Text style={styles.aiLabel}>Confidence</Text>
                    <Text style={styles.aiValue}>
                        {Math.round(confidencePercent * 100)}%
                    </Text>
                </View>

                {!!imageQualityOverall && (
                    <View style={styles.aiRow}>
                        <Text style={styles.aiLabel}>Photo quality</Text>
                        <Text style={styles.aiValue}>
                            {imageQualityOverall}
                            {typeof imageQualityConfidence === "number"
                                ? ` (${Math.round(imageQualityConfidence * 100)}%)`
                                : ""}
                        </Text>
                    </View>
                )}

                {(typeof wateringFrequencyDays === "number" ||
                    (typeof safeDryMin === "number" && typeof safeDryMax === "number") ||
                    !!moisturePref) && (
                    <View style={styles.aiSection}>
                        <Text style={styles.aiSectionTitle}>Watering</Text>
                        {typeof wateringFrequencyDays === "number" && (
                            <Text style={styles.aiText}>
                                Suggested cadence: every {wateringFrequencyDays} days
                            </Text>
                        )}
                        {typeof safeDryMin === "number" && typeof safeDryMax === "number" && (
                            <Text style={styles.aiText}>
                                Safe dry period window: {safeDryMin}-{safeDryMax} days
                            </Text>
                        )}
                        {!!moisturePref && (
                            <Text style={styles.aiText}>
                                Soil moisture target: {moisturePref.replace(/_/g, " ")}
                            </Text>
                        )}
                    </View>
                )}

                {!!advice && (
                    <View style={styles.aiSection}>
                        <Text style={styles.aiSectionTitle}>Advice</Text>
                        <Text style={styles.aiText}>{advice}</Text>
                    </View>
                )}

                {!!warningTriggers?.length && (
                    <View style={styles.aiSection}>
                        <Text style={styles.aiSectionTitle}>Watch for</Text>
                        <Text style={styles.aiText}>{warningTriggers.join(", ")}</Text>
                    </View>
                )}
            </View>
        );
    };

    const handleSave = async () => {
        if (!name.trim()) {
            showAlert("Missing name", "Please enter a name for your plant");
            return;
        }

        const days = parseInt(wateringDays) || 7;
        const lastWateredISO = lastWatered.toISOString();
        const nextWater = addDays(lastWatered, days).toISOString();

        const newPlant: Plant = {
            id: Date.now().toString(),
            name: name.trim(),
            species: commonName || undefined,
            imageUri,
            wateringFrequencyDays: days,
            lastWatered: lastWateredISO,
            nextWatering: nextWater,
            notes: notes.trim() || undefined,
            addedDate: new Date().toISOString(),
        };

        try {
            await storageService.addPlant(newPlant);
            navigation.goBack();
        } catch (error) {
            showAlert("Error", "Failed to save plant");
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.content}>
                {!imageUri ? (
                    // Camera prompt
                    <View style={styles.cameraPrompt}>
                        <Text style={styles.promptIcon}>📷</Text>
                        <Text style={styles.promptTitle}>Take a photo</Text>
                        <Text style={styles.promptText}>
                            Position your plant in good lighting and capture a
                            clear shot of the leaves
                        </Text>
                        <View style={styles.cameraButtons}>
                            <TouchableOpacity
                                style={styles.cameraPrimaryButton}
                                onPress={takePhoto}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cameraPrimaryButtonText}>
                                    Open Camera
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cameraSecondaryButton}
                                onPress={pickImage}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cameraSecondaryButtonText}>
                                    Choose from Gallery
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    // Photo taken - show identify flow
                    <>
                        <View style={styles.imageContainer}>
                            <Image
                                source={{ uri: imageUri }}
                                style={styles.image}
                            />
                            {confidence > 0 && confidence <= 1 && (
                                <View
                                    style={[
                                        styles.confidenceBadge,
                                        confidence >= 0.85
                                            ? styles.confidenceHigh
                                            : confidence >= 0.6
                                              ? styles.confidenceMedium
                                              : styles.confidenceLow,
                                    ]}
                                >
                                    <Text style={styles.confidenceText}>
                                        {Math.round(confidence * 100)}%
                                        confident
                                    </Text>
                                </View>
                            )}
                        </View>

                        {!identified ? (
                            // Show identifying state or retry
                            <View style={styles.actionButtons}>
                                {identifying ? (
                                    <MotiView
                                        from={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            type: "spring",
                                            damping: 15,
                                        }}
                                        style={styles.identifyingBox}
                                    >
                                        <MotiView
                                            from={{ scale: 1 }}
                                            animate={{ scale: 1.1 }}
                                            transition={{
                                                type: "timing",
                                                duration: 1000,
                                                loop: true,
                                            }}
                                            style={styles.identifyingSpinner}
                                        >
                                            <ActivityIndicator
                                                color={colors.primary}
                                                size="large"
                                            />
                                        </MotiView>
                                        <Text
                                            style={styles.identifyingTextLarge}
                                        >
                                            Identifying your plant
                                        </Text>
                                        {userLocation && (
                                            <Text style={styles.locationText}>
                                                📍{" "}
                                                {locationService.getLocationString(
                                                    userLocation,
                                                )}
                                            </Text>
                                        )}
                                        <MotiView
                                            from={{ opacity: 0.3 }}
                                            animate={{ opacity: 1 }}
                                            transition={{
                                                type: "timing",
                                                duration: 800,
                                                loop: true,
                                            }}
                                            style={styles.identifyingDots}
                                        >
                                            <Text
                                                style={
                                                    styles.identifyingDotsText
                                                }
                                            >
                                                •••
                                            </Text>
                                        </MotiView>
                                    </MotiView>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            style={styles.identifyButton}
                                            onPress={() => handleIdentify()}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={
                                                    styles.identifyButtonText
                                                }
                                            >
                                                Analyse Plant
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.manualButton}
                                            onPress={() => {
                                                setIdentified(true);
                                                setCommonName("Unknown Plant");
                                                setName("");
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={styles.manualButtonText}
                                            >
                                                Not Sure? Enter Manually
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {!!debugInfo && (
                                    <View style={styles.debugBox}>
                                        <Text style={styles.debugText}>
                                            {debugInfo}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            // Show form after identification
                            <MotiView
                                from={{ opacity: 0, translateY: 20 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                transition={{ type: "spring", damping: 20 }}
                                style={styles.form}
                            >
                                {renderAiSummary()}
                                <MotiView
                                    from={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                        type: "spring",
                                        damping: 12,
                                        delay: 100,
                                    }}
                                    style={styles.identifiedHeader}
                                >
                                    <Text style={styles.identifiedIcon}>✓</Text>
                                    <Text style={styles.identifiedTitle}>
                                        {commonName || "Plant Identified"}
                                    </Text>
                                </MotiView>

                                <Text style={styles.label}>Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="My plant's name"
                                    placeholderTextColor={colors.textTertiary}
                                />

                                <Text style={styles.label}>Last watered</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowDatePicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.dateButtonText}>
                                        {lastWatered.toLocaleDateString(
                                            "en-US",
                                            {
                                                weekday: "short",
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            },
                                        )}
                                    </Text>
                                </TouchableOpacity>

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={lastWatered}
                                        mode="date"
                                        display={
                                            Platform.OS === "ios"
                                                ? "spinner"
                                                : "default"
                                        }
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(
                                                Platform.OS === "ios",
                                            );
                                            if (selectedDate) {
                                                setLastWatered(selectedDate);
                                            }
                                        }}
                                        maximumDate={new Date()}
                                        minimumDate={
                                            new Date(
                                                Date.now() -
                                                    30 * 24 * 60 * 60 * 1000,
                                            )
                                        }
                                    />
                                )}

                                <Text style={styles.label}>Next Watering</Text>
                                <View style={styles.dateButton}>
                                    <Text style={styles.dateButtonText}>
                                        {addDays(
                                            lastWatered,
                                            parseInt(wateringDays) || 7,
                                        ).toLocaleDateString("en-US", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </Text>
                                    <Text style={styles.dateButtonSubtext}>
                                        (in {wateringDays || "7"} days)
                                    </Text>
                                </View>

                                <View style={styles.bottomActions}>
                                    <TouchableOpacity
                                        style={styles.retakeSmallButton}
                                        onPress={takePhoto}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={styles.retakeSmallButtonText}
                                        >
                                            Retake
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.saveButton}
                                        onPress={handleSave}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.saveButtonText}>
                                            Save Plant
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </MotiView>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    cameraPrompt: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 60,
    },
    promptIcon: {
        fontSize: 64,
        marginBottom: 24,
    },
    promptTitle: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 12,
    },
    promptText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: 32,
        paddingHorizontal: 20,
        lineHeight: 24,
    },
    cameraButtons: {
        width: "100%",
        gap: 12,
    },
    cameraPrimaryButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    cameraPrimaryButtonText: {
        color: colors.background,
        fontSize: 17,
        fontWeight: "600",
    },
    cameraSecondaryButton: {
        backgroundColor: colors.surface,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    cameraSecondaryButtonText: {
        color: colors.text,
        fontSize: 17,
        fontWeight: "600",
    },
    imageContainer: {
        position: "relative",
        marginBottom: 20,
    },
    image: {
        width: "100%",
        height: 300,
        borderRadius: 16,
    },
    confidenceBadge: {
        position: "absolute",
        top: 12,
        right: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    confidenceHigh: {
        backgroundColor: colors.primary,
    },
    confidenceMedium: {
        backgroundColor: colors.warning,
    },
    confidenceLow: {
        backgroundColor: colors.danger,
    },
    confidenceText: {
        color: colors.background,
        fontSize: 13,
        fontWeight: "700",
    },
    actionButtons: {
        gap: 12,
    },
    identifyButton: {
        backgroundColor: colors.primary,
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: "center",
        minHeight: 56,
        justifyContent: "center",
    },
    identifyButtonText: {
        color: colors.background,
        fontSize: 17,
        fontWeight: "600",
    },
    retakeButton: {
        backgroundColor: colors.surface,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
    },
    retakeButtonText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: "600",
    },
    form: {
        gap: 20,
    },
    identifiedHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    identifiedIcon: {
        fontSize: 24,
        marginRight: 8,
    },
    identifiedTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: colors.primary,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: -12,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dateButton: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dateButtonText: {
        fontSize: 16,
        color: colors.text,
    },
    dateButtonSubtext: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 4,
    },
    textArea: {
        minHeight: 100,
        paddingTop: 16,
    },
    bottomActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    retakeSmallButton: {
        flex: 1,
        backgroundColor: colors.surface,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    retakeSmallButtonText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: "600",
    },
    saveButton: {
        flex: 2,
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    saveButtonText: {
        color: colors.background,
        fontSize: 17,
        fontWeight: "600",
    },
    debugBox: {
        backgroundColor: colors.surfaceLight,
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    debugText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontFamily: "monospace",
        lineHeight: 18,
    },
    aiCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
    },
    aiTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "700",
    },
    aiSubtitle: {
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: -6,
    },
    aiRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    aiLabel: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: "600",
    },
    aiValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "700",
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
    identifyingBox: {
        alignItems: "center",
        paddingVertical: 60,
        gap: 20,
    },
    identifyingSpinner: {
        marginBottom: 12,
    },
    identifyingTextLarge: {
        color: colors.text,
        fontSize: 22,
        fontWeight: "700",
    },
    identifyingText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "600",
    },
    locationText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    identifyingDots: {
        marginTop: 8,
    },
    identifyingDotsText: {
        color: colors.primary,
        fontSize: 24,
        letterSpacing: 4,
    },
    manualButton: {
        backgroundColor: "transparent",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    manualButtonText: {
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: "500",
    },
});
