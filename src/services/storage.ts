import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Plant, WateringEvent } from '../types/plant';
import { notificationService } from './notifications';

const PLANTS_KEY = '@flaurel:plants';
const WATERING_HISTORY_KEY = '@flaurel:watering_history';

export const storageService = {
  async getPlants(): Promise<Plant[]> {
    try {
      const data = await AsyncStorage.getItem(PLANTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading plants:', error);
      return [];
    }
  },

  async savePlants(plants: Plant[]): Promise<void> {
    try {
      await AsyncStorage.setItem(PLANTS_KEY, JSON.stringify(plants));
    } catch (error) {
      console.error('Error saving plants:', error);
      throw error;
    }
  },

  async addPlant(plant: Plant): Promise<void> {
    const plants = await this.getPlants();
    plants.push(plant);
    await this.savePlants(plants);

    // Schedule notification for the new plant (only on native)
    if (Platform.OS !== 'web') {
      await notificationService.scheduleWateringNotification(plant);
    }
  },

  async updatePlant(updatedPlant: Plant): Promise<void> {
    const plants = await this.getPlants();
    const index = plants.findIndex(p => p.id === updatedPlant.id);
    if (index !== -1) {
      plants[index] = updatedPlant;
      await this.savePlants(plants);

      // Reschedule notification for the updated plant (only on native)
      if (Platform.OS !== 'web') {
        await notificationService.scheduleWateringNotification(updatedPlant);
      }
    }
  },

  async deletePlant(plantId: string): Promise<void> {
    try {
      const plants = await this.getPlants();
      const filtered = plants.filter(p => p.id !== plantId);
      await this.savePlants(filtered);

      // Cancel notifications for the deleted plant (only on native)
      if (Platform.OS !== 'web') {
        await notificationService.cancelPlantNotifications(plantId);
      }
    } catch (error) {
      console.error('Error deleting plant:', error);
      throw error;
    }
  },

  async getWateringHistory(): Promise<WateringEvent[]> {
    try {
      const data = await AsyncStorage.getItem(WATERING_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading watering history:', error);
      return [];
    }
  },

  async addWateringEvent(event: WateringEvent): Promise<void> {
    const history = await this.getWateringHistory();
    history.push(event);
    await AsyncStorage.setItem(WATERING_HISTORY_KEY, JSON.stringify(history));
  },
};
