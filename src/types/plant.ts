export interface Plant {
  id: string;
  name: string;
  species?: string;
  imageUri?: string;
  wateringFrequencyDays: number;
  lastWatered: string; // ISO date string
  nextWatering: string; // ISO date string
  notes?: string;
  addedDate: string; // ISO date string
}

export interface WateringEvent {
  plantId: string;
  date: string; // ISO date string
  soilWasWet: boolean;
  deferredDays?: number;
}
