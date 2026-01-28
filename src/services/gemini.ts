import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const GEMINI_API_KEY = "AIzaSyDnyTJC-L8u95qMjUWUf823sOQO1gVm3aQ"; // Get from https://makersuite.google.com/app/apikey

export interface PlantIdentification {
  isPlant: boolean;
  confidence: number;
  scientificName: string | null;
  commonName: string | null;
  wateringFrequencyDays: number | null;
  sunlightNeeds: string | null;
  careLevel: string | null;
  description: string | null;
  advice: string | null;
}

export const geminiService = {
  async identifyPlant(
    imageUri: string,
    locationContext?: { season: string; city?: string; country?: string }
  ): Promise<PlantIdentification> {
    try {
      // if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
      //   console.warn('Gemini API key not configured, using mock identification');
      //   return this.mockIdentification();
      // }

      // Read image as base64 - handle web vs native differently
      let base64: string;

      if (Platform.OS === 'web') {
        // Web: fetch the blob and convert to base64
        const response = await fetch(imageUri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data:image/jpeg;base64, prefix
            const base64String = result.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // Native: use FileSystem
        base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
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
      let locationInfo = '';
      if (locationContext) {
        locationInfo = `\n\nUSER LOCATION CONTEXT:\nSeason: ${locationContext.season}`;
        if (locationContext.city) locationInfo += `\nCity: ${locationContext.city}`;
        if (locationContext.country) locationInfo += `\nCountry: ${locationContext.country}`;
        locationInfo += `\n\nIMPORTANT: Adjust watering frequency based on season! Winter = longer intervals, Summer = shorter intervals.`;
      }

      const prompt = `You are a professional botanist specializing in houseplant identification. Analyze this image with EXTREME PRECISION.

CRITICAL IMAGE QUALITY REQUIREMENTS:
Before attempting identification, assess the photo quality:
- Is the plant in focus? (not blurry)
- Is lighting adequate to see leaf details?
- Can you clearly see leaf shape, edges, and texture?
- Is the plant close enough to see distinguishing features?

If ANY of these are false, set confidence < 0.4 and provide specific advice on what's wrong with the photo.

IDENTIFICATION PROTOCOL:
1. LEAF SHAPE (most critical):
   - Pilea peperomioides (Chinese Money Plant): PERFECTLY ROUND coins on individual stems, peltate attachment
   - Pothos: Heart-shaped, asymmetrical base, trailing
   - Philodendron: Heart-shaped, SYMMETRICAL base
   - Monstera: Large, splits/fenestrations (holes)
   - Snake Plant: Long, upright, sword-like
   - ZZ Plant: Oval, extremely glossy, on rachis

2. GROWTH HABIT:
   - Upright rosette from center (Pilea, Snake Plant)
   - Trailing/climbing vine (Pothos, Philodendron)
   - Upright single stem (Rubber Plant, Fiddle Leaf Fig)

3. UNIQUE FEATURES:
   - Round leaves on long individual stalks = Pilea
   - Fenestrations (holes) = Monstera
   - Heart shape + asymmetrical base = Pothos

WATERING FREQUENCY GUIDELINES:${locationInfo}

Base watering intervals (adjust for season):
- Succulents: 14-21 days (winter: 21-30 days)
- Snake Plant, ZZ Plant: 14-21 days
- Pothos, Philodendron: 7-10 days (winter: 10-14 days)
- Monstera, Fiddle Leaf Fig: 7-10 days (winter: 10-14 days)
- Ferns, Peace Lily: 5-7 days (winter: 7-10 days)

CONFIDENCE SCORING (BE HARSH):
- 0.85-1.0: Multiple unique features crystal clear, perfect photo
- 0.60-0.84: Good photo, clear features, confident ID
- 0.40-0.59: Mediocre photo OR generic features, might be this plant
- 0.00-0.39: Poor photo quality OR cannot see key features

If confidence < 0.6, provide SPECIFIC advice in the "advice" field about what's wrong with the photo or what features you need to see.

Return ONLY this JSON:
{
  "isPlant": boolean,
  "confidence": number,
  "scientificName": string | null,
  "commonName": string | null,
  "wateringFrequencyDays": number | null,
  "sunlightNeeds": string | null,
  "careLevel": string | null,
  "description": string | null,
  "advice": string | null
}

Return only JSON, no explanation.`;

      console.log('🌿 Sending image to Gemini for plant identification...');

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64,
          },
        },
      ]);

      const text = result?.response?.text ? result.response.text() : '';
      console.log('🤖 Gemini raw response:', text);

      // Parse JSON response
      try {
        const cleaned = text
          .replace(/^```(json)?/i, '')
          .replace(/```$/, '')
          .trim();
        const parsed = JSON.parse(cleaned);

        console.log('✅ Gemini parsed result:', {
          commonName: parsed?.commonName,
          scientificName: parsed?.scientificName,
          confidence: parsed?.confidence,
          isPlant: parsed?.isPlant,
        });

        const finalResult = {
          isPlant: !!parsed?.isPlant,
          confidence: Number(parsed?.confidence ?? 0) || 0,
          scientificName: parsed?.scientificName || null,
          commonName: parsed?.commonName || null,
          wateringFrequencyDays: parsed?.wateringFrequencyDays
            ? Number(parsed.wateringFrequencyDays)
            : null,
          sunlightNeeds: parsed?.sunlightNeeds || null,
          careLevel: parsed?.careLevel || null,
          description: parsed?.description || null,
          advice: parsed?.advice || null,
        };

        console.log('📊 Final confidence score:', finalResult.confidence);
        return finalResult;
      } catch (e) {
        console.error('❌ Failed to parse Gemini response:', e);
        console.error('Raw text was:', text);
        throw new Error('Invalid response from plant identification');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      // Fall back to mock identification
      return this.mockIdentification();
    }
  },

  // Mock identification for demo/testing
  mockIdentification(): PlantIdentification {
    const plants = [
      {
        isPlant: true,
        confidence: 0.95,
        scientificName: 'Monstera deliciosa',
        commonName: 'Swiss Cheese Plant',
        wateringFrequencyDays: 7,
        sunlightNeeds: 'bright indirect',
        careLevel: 'easy',
        description:
          'Allow soil to dry between waterings. Thrives in bright indirect light.',
      },
      {
        isPlant: true,
        confidence: 0.92,
        scientificName: 'Epipremnum aureum',
        commonName: 'Pothos',
        wateringFrequencyDays: 5,
        sunlightNeeds: 'bright indirect',
        careLevel: 'easy',
        description:
          'Very hardy trailing vine. Water when top soil is dry. Tolerates low light.',
      },
      {
        isPlant: true,
        confidence: 0.91,
        scientificName: 'Sansevieria trifasciata',
        commonName: 'Snake Plant',
        wateringFrequencyDays: 14,
        sunlightNeeds: 'partial shade',
        careLevel: 'easy',
        description:
          'Extremely low maintenance. Water sparingly, prefers to dry out completely.',
      },
      {
        isPlant: true,
        confidence: 0.88,
        scientificName: 'Ficus lyrata',
        commonName: 'Fiddle Leaf Fig',
        wateringFrequencyDays: 7,
        sunlightNeeds: 'bright indirect',
        careLevel: 'moderate',
        description:
          'Needs consistent watering and bright light. Sensitive to changes.',
      },
    ];

    return plants[Math.floor(Math.random() * plants.length)];
  },
};
