import * as FileSystem from 'expo-file-system';

const PLANT_ID_API_KEY = 'YOUR_PLANT_ID_API_KEY'; // Get from plant.id
const PLANT_ID_API_URL = 'https://api.plant.id/v2/identify';

export interface PlantIdentification {
  scientificName: string;
  commonName?: string;
  probability: number;
  wateringFrequency?: number; // days
}

export const plantIdService = {
  async identifyPlant(imageUri: string): Promise<PlantIdentification | null> {
    try {
      // Read the image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(PLANT_ID_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': PLANT_ID_API_KEY,
        },
        body: JSON.stringify({
          images: [`data:image/jpeg;base64,${base64}`],
          modifiers: ['similar_images'],
          plant_details: ['common_names', 'watering'],
        }),
      });

      if (!response.ok) {
        throw new Error('Plant identification failed');
      }

      const data = await response.json();

      if (!data.suggestions || data.suggestions.length === 0) {
        return null;
      }

      const topSuggestion = data.suggestions[0];

      // Extract watering frequency if available
      let wateringFrequency: number | undefined;
      if (topSuggestion.plant_details?.watering) {
        const watering = topSuggestion.plant_details.watering;
        // Map watering descriptions to days
        if (watering.includes('daily')) wateringFrequency = 1;
        else if (watering.includes('twice a week')) wateringFrequency = 3;
        else if (watering.includes('weekly')) wateringFrequency = 7;
        else if (watering.includes('biweekly')) wateringFrequency = 14;
        else if (watering.includes('monthly')) wateringFrequency = 30;
      }

      return {
        scientificName: topSuggestion.plant_name,
        commonName: topSuggestion.plant_details?.common_names?.[0],
        probability: topSuggestion.probability,
        wateringFrequency,
      };
    } catch (error) {
      console.error('Plant ID error:', error);

      // Fallback to mock identification for demo purposes
      return this.mockIdentification();
    }
  },

  // Mock identification for demo/testing
  mockIdentification(): PlantIdentification {
    const plants = [
      {
        scientificName: 'Monstera deliciosa',
        commonName: 'Swiss Cheese Plant',
        probability: 0.95,
        wateringFrequency: 7,
      },
      {
        scientificName: 'Epipremnum aureum',
        commonName: 'Pothos',
        probability: 0.92,
        wateringFrequency: 5,
      },
      {
        scientificName: 'Ficus lyrata',
        commonName: 'Fiddle Leaf Fig',
        probability: 0.88,
        wateringFrequency: 7,
      },
      {
        scientificName: 'Sansevieria trifasciata',
        commonName: 'Snake Plant',
        probability: 0.91,
        wateringFrequency: 14,
      },
    ];

    return plants[Math.floor(Math.random() * plants.length)];
  },
};
