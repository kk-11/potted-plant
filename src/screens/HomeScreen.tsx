import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MotiView } from 'moti';
import { Plant } from '../types/plant';
import { storageService } from '../services/storage';
import { formatRelativeDate, isPastDue } from '../utils/dateUtils';
import { colors } from '../theme/colors';

export default function HomeScreen({ navigation }: any) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlants = async () => {
    const loadedPlants = await storageService.getPlants();
    loadedPlants.sort((a, b) =>
      new Date(a.nextWatering).getTime() - new Date(b.nextWatering).getTime()
    );
    setPlants(loadedPlants);
  };

  useFocusEffect(
    useCallback(() => {
      loadPlants();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlants();
    setRefreshing(false);
  };

  const renderPlant = ({ item, index }: { item: Plant; index: number }) => {
    const overdue = isPastDue(item.nextWatering);

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{
          type: 'timing',
          duration: 400,
          delay: index * 50,
        }}
      >
        <TouchableOpacity
          style={styles.plantCard}
          onPress={() => navigation.navigate('PlantDetail', { plantId: item.id })}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.plantImage} />
            ) : (
              <View style={[styles.plantImage, styles.imagePlaceholder]}>
                <Text style={styles.placeholderIcon}>🌱</Text>
              </View>
            )}
            <View style={styles.plantInfo}>
              <Text style={styles.plantName} numberOfLines={1}>{item.name}</Text>
              {item.species && (
                <Text style={styles.plantSpecies} numberOfLines={1}>{item.species}</Text>
              )}
              <View style={styles.wateringRow}>
                <View style={[styles.statusDot, overdue && styles.statusDotOverdue]} />
                <Text style={[styles.wateringInfo, overdue && styles.overdueText]}>
                  {formatRelativeDate(item.nextWatering)}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
      <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <View style={styles.header}>
              <Text style={styles.title}>🪴</Text>
              <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => navigation.navigate("AddPlant")}
                  activeOpacity={0.7}
              >
                  <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
          </View>

          {plants.length === 0 ? (
              <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🪴</Text>
                  <Text style={styles.emptyText}>No plants yet</Text>
                  <Text style={styles.emptySubtext}>
                      Tap + to add your first plant
                  </Text>
              </View>
          ) : (
              <FlatList
                  data={plants}
                  renderItem={renderPlant}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  refreshControl={
                      <RefreshControl
                          refreshing={refreshing}
                          onRefresh={onRefresh}
                          tintColor={colors.primary}
                      />
                  }
              />
          )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.background,
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  list: {
    padding: 20,
    paddingTop: 8,
  },
  plantCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  plantImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 16,
  },
  imagePlaceholder: {
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 28,
  },
  plantInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  plantName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  plantSpecies: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  wateringRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  statusDotOverdue: {
    backgroundColor: colors.danger,
  },
  wateringInfo: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  overdueText: {
    color: colors.danger,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textTertiary,
  },
});
