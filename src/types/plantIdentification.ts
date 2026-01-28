export interface PlantIdentification {
    inputAssessment: {
        imageQuality: {
            overall: "excellent" | "good" | "fair" | "poor";
            confidence: number;
            issues: string[];
        };
        improvementSuggestions: string[];
        usableFor: {
            identification: "high" | "medium" | "low";
            careInference: "high" | "medium" | "low";
        };
    };

    identification: {
        isPlant: boolean;
        confidence: number;
        scientificName: string | null;
        commonName: string | null;
        confidenceByField: {
            scientificName: number;
            commonName: number;
            careProfile: number;
        };
    };

    careProfile: {
        water: {
            tolerance: {
                dry: "high" | "medium" | "low" | "unknown";
                wet: "high" | "medium" | "low" | "unknown";
            };
            rootRotRisk: "high" | "medium" | "low" | "unknown";
            preferredSoilMoisture:
                | "dry"
                | "slightly_dry_between_watering"
                | "evenly_moist"
                | "moist"
                | "unknown";
            safeDryPeriodDays: {
                min: number;
                max: number;
            };
        };

        light: {
            preferred:
                | "full_sun"
                | "bright_indirect"
                | "medium"
                | "low"
                | "unknown";
            tolerates: string[];
        };

        growthCycle: {
            activeMonths: number[];
            dormantMonths: number[];
        };

        hardiness: {
            minTempC: number | null;
            maxTempC: number | null;
        };
    };

    environmentalSensitivity: {
        seasonalityImpact: "high" | "medium" | "low";
        humidityImpact: "high" | "medium" | "low";
        potSizeImpact: "high" | "medium" | "low";
        soilTypeImpact: "high" | "medium" | "low";
    };

    wateringLogicHints: {
        defaultBias: "delay" | "neutral";
        recommendedCheck:
            | "soil_depth_finger_test"
            | "moisture_meter"
            | "pot_weight"
            | "visual_only";
        warningTriggers: string[];
    };

    modelVerdicts: {
        canIdentifyPlant: boolean;
        canInferWatering: boolean;
        requiresBetterInput: boolean;
    };

    derivedSummary: {
        wateringFrequencyDays: number | null;
        sunlightNeeds: string | null;
        careLevel: "easy" | "moderate" | "difficult" | null;
    };

    notes: {
        description: string | null;
        advice: string | null;
        uncertainty: string | null;
    };
}
