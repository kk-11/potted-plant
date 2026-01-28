import { GoogleGenerativeAI } from "@google/generative-ai";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { prompt } from "./prompt";
import { PlantIdentification } from "../types/plantIdentification";

const GEMINI_API_KEY =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ??
    Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;

export const geminiService = {
    async identifyPlant(
        imageUri: string,
        locationContext?: { season: string; city?: string; country?: string },
    ): Promise<PlantIdentification> {
        try {
            // if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
            //   console.warn('Gemini API key not configured, using mock identification');
            //   return this.mockIdentification();
            // }

            // Read image as base64 - handle web vs native differently
            let base64: string;

            if (Platform.OS === "web") {
                // Web: fetch the blob and convert to base64
                const response = await fetch(imageUri);
                const blob = await response.blob();
                base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        // Remove data:image/jpeg;base64, prefix
                        const base64String = result.split(",")[1];
                        resolve(base64String);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } else {
                // Native: use modern expo-file-system API
                const file = new File(imageUri);
                base64 = await file.base64();
            }

            if (!GEMINI_API_KEY) {
                throw new Error("Missing EXPO_PUBLIC_GEMINI_API_KEY");
            }

            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-3-flash-preview", // Stable vision model
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                },
            });

            // Build location context string
            let locationInfo = "";
            if (locationContext) {
                locationInfo = `\n\nUSER LOCATION CONTEXT:\nSeason: ${locationContext.season}`;
                if (locationContext.city)
                    locationInfo += `\nCity: ${locationContext.city}`;
                if (locationContext.country)
                    locationInfo += `\nCountry: ${locationContext.country}`;
                locationInfo += `\n\nIMPORTANT: Adjust watering frequency based on season! Winter = longer intervals, Summer = shorter intervals.`;
            }

            console.log(
                "🌿 Sending image to Gemini for plant identification...",
            );

            const result = await model.generateContent([
                { text: prompt(locationInfo) },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: base64,
                    },
                },
            ]);

            const text = result?.response?.text ? result.response.text() : "";
            console.log("🤖 Gemini raw response:", text);

            // Parse JSON response
            try {
                const cleaned = text
                    .replace(/^```(json)?/i, "")
                    .replace(/```$/, "")
                    .trim();
                const parsed = JSON.parse(cleaned) as PlantIdentification;

                console.log("✅ Gemini parsed result:", {
                    commonName: parsed?.identification?.commonName,
                    scientificName: parsed?.identification?.scientificName,
                    confidence: parsed?.identification?.confidence,
                    isPlant: parsed?.identification?.isPlant,
                });

                return parsed;
            } catch (e) {
                console.error("❌ Failed to parse Gemini response:", e);
                console.error("Raw text was:", text);
                throw new Error("Invalid response from plant identification");
            }
        } catch (error) {
            console.error("Gemini API error:", error);
            // Fall back to mock identification
            return this.mockIdentification();
        }
    },

    // Mock identification for demo/testing
    mockIdentification(): PlantIdentification {
        const plants: PlantIdentification[] = [
            {
                inputAssessment: {
                    imageQuality: {
                        overall: "good",
                        confidence: 0.8,
                        issues: [],
                    },
                    improvementSuggestions: [],
                    usableFor: {
                        identification: "high",
                        careInference: "high",
                    },
                },
                identification: {
                    isPlant: true,
                    confidence: 0.95,
                    scientificName: "Monstera deliciosa",
                    commonName: "Swiss Cheese Plant",
                    confidenceByField: {
                        scientificName: 0.9,
                        commonName: 0.9,
                        careProfile: 0.85,
                    },
                },
                careProfile: {
                    water: {
                        tolerance: {
                            dry: "medium",
                            wet: "low",
                        },
                        rootRotRisk: "medium",
                        preferredSoilMoisture: "slightly_dry_between_watering",
                        safeDryPeriodDays: {
                            min: 5,
                            max: 10,
                        },
                    },
                    light: {
                        preferred: "bright_indirect",
                        tolerates: ["medium"],
                    },
                    growthCycle: {
                        activeMonths: [3, 4, 5, 6, 7, 8, 9, 10],
                        dormantMonths: [11, 12, 1, 2],
                    },
                    hardiness: {
                        minTempC: 12,
                        maxTempC: 30,
                    },
                },
                environmentalSensitivity: {
                    seasonalityImpact: "medium",
                    humidityImpact: "medium",
                    potSizeImpact: "medium",
                    soilTypeImpact: "high",
                },
                wateringLogicHints: {
                    defaultBias: "delay",
                    recommendedCheck: "soil_depth_finger_test",
                    warningTriggers: ["yellowing lower leaves", "mushy stems"],
                },
                modelVerdicts: {
                    canIdentifyPlant: true,
                    canInferWatering: true,
                    requiresBetterInput: false,
                },
                derivedSummary: {
                    wateringFrequencyDays: 7,
                    sunlightNeeds: "Bright indirect light",
                    careLevel: "easy",
                },
                notes: {
                    description:
                        "Allow soil to dry slightly between waterings. Thrives in bright indirect light.",
                    advice: null,
                    uncertainty: null,
                },
            },
            {
                inputAssessment: {
                    imageQuality: {
                        overall: "good",
                        confidence: 0.75,
                        issues: [],
                    },
                    improvementSuggestions: [],
                    usableFor: {
                        identification: "high",
                        careInference: "high",
                    },
                },
                identification: {
                    isPlant: true,
                    confidence: 0.92,
                    scientificName: "Epipremnum aureum",
                    commonName: "Pothos",
                    confidenceByField: {
                        scientificName: 0.85,
                        commonName: 0.9,
                        careProfile: 0.8,
                    },
                },
                careProfile: {
                    water: {
                        tolerance: {
                            dry: "medium",
                            wet: "low",
                        },
                        rootRotRisk: "medium",
                        preferredSoilMoisture: "slightly_dry_between_watering",
                        safeDryPeriodDays: {
                            min: 4,
                            max: 9,
                        },
                    },
                    light: {
                        preferred: "bright_indirect",
                        tolerates: ["medium", "low"],
                    },
                    growthCycle: {
                        activeMonths: [3, 4, 5, 6, 7, 8, 9, 10],
                        dormantMonths: [11, 12, 1, 2],
                    },
                    hardiness: {
                        minTempC: 12,
                        maxTempC: 30,
                    },
                },
                environmentalSensitivity: {
                    seasonalityImpact: "medium",
                    humidityImpact: "medium",
                    potSizeImpact: "medium",
                    soilTypeImpact: "medium",
                },
                wateringLogicHints: {
                    defaultBias: "delay",
                    recommendedCheck: "soil_depth_finger_test",
                    warningTriggers: ["yellowing lower leaves", "mushy stems"],
                },
                modelVerdicts: {
                    canIdentifyPlant: true,
                    canInferWatering: true,
                    requiresBetterInput: false,
                },
                derivedSummary: {
                    wateringFrequencyDays: 7,
                    sunlightNeeds: "Bright indirect light",
                    careLevel: "easy",
                },
                notes: {
                    description:
                        "Hardy trailing vine. Water when top soil is dry. Tolerates lower light.",
                    advice: null,
                    uncertainty: null,
                },
            },
        ];

        return plants[Math.floor(Math.random() * plants.length)];
    },
};
