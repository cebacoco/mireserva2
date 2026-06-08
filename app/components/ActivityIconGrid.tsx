import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLang } from '../lib/i18n';

const { width } = Dimensions.get('window');

interface ActivityIconGridProps {
  activities?: any[];
  onActivityPress?: (activity: any) => void;
  onFishingPress?: () => void;
  onTabSwitch?: (tab: string) => void;
  activeTab?: string;
  compact?: boolean;
}

export const TAB_ICONS: {
  key: string;
  labelKey: string;
  labelFallback: string;
  icon: string;
  lib: 'ion' | 'mci';
  color: string;
  bgColor: string;
}[] = [
  { key: 'boat', labelKey: 'tab_boat', labelFallback: 'Boat', icon: 'sail-boat', lib: 'mci', color: '#0369A1', bgColor: '#E0F2FE' },
  { key: 'water', labelKey: 'tab_water', labelFallback: 'Water', icon: 'waves', lib: 'mci', color: '#0D9488', bgColor: '#F0FDFA' },
  { key: 'island', labelKey: 'tab_island', labelFallback: 'Island', icon: 'palm-tree', lib: 'mci', color: '#16A34A', bgColor: '#F0FDF4' },
  { key: 'overnight', labelKey: 'tab_overnight', labelFallback: 'Overnight', icon: 'sleep', lib: 'mci', color: '#7C3AED', bgColor: '#F5F3FF' },
  { key: 'fishing', labelKey: 'tab_fishing', labelFallback: 'Fishing', icon: 'fish', lib: 'mci', color: '#2563EB', bgColor: '#EFF6FF' },
  { key: 'food', labelKey: 'tab_food', labelFallback: 'Food', icon: 'restaurant', lib: 'ion', color: '#EA580C', bgColor: '#FFF7ED' },
];

export default function ActivityIconGrid({ onTabSwitch, activeTab, compact }: ActivityIconGridProps) {
  const { t } = useLang();
  const itemWidth = (width - 32) / TAB_ICONS.length;
  const circleSize = compact ? 40 : 50;
  const innerSize = compact ? 34 : 42;
  const iconSize = compact ? 20 : 23;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {!compact && (
        <View style={styles.headerRow}>
          <View style={styles.headerLine} />
          <Text style={styles.headerLabel}>{t('explore_activities')}</Text>
          <View style={styles.headerLine} />
        </View>
      )}

      <View style={styles.grid}>
        {TAB_ICONS.map((item) => {
          const isActive = item.key === activeTab;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.iconItem, { width: itemWidth }]}
              onPress={() => onTabSwitch?.(item.key)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconCircle,
                  { width: circleSize, height: circleSize, borderRadius: circleSize / 3 },
                  { backgroundColor: isActive ? item.color : item.bgColor },
                ]}
              >
                <View
                  style={[
                    styles.iconInner,
                    { width: innerSize, height: innerSize, borderRadius: innerSize / 3 },
                    { backgroundColor: item.color },
                    isActive && { opacity: 0.85 },
                  ]}
                >
                  {item.lib === 'ion' ? (
                    <Ionicons name={item.icon as any} size={iconSize} color="#fff" />
                  ) : (
                    <MaterialCommunityIcons name={item.icon as any} size={iconSize} color="#fff" />
                  )}
                </View>
              </View>
              <Text
                style={[styles.iconLabel, compact && styles.iconLabelCompact, isActive && { color: item.color, fontWeight: '800' }]}
                numberOfLines={1}
              >
                {t(item.labelKey) === item.labelKey ? item.labelFallback : t(item.labelKey)}
              </Text>
              {isActive && !compact && (
                <View style={[styles.activeDot, { backgroundColor: item.color }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  containerCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginHorizontal: 12,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconItem: {
    alignItems: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  iconLabelCompact: {
    fontSize: 9,
    marginBottom: 0,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
});
