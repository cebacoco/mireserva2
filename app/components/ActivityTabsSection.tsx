import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Activity } from '../lib/types';
import { useCart } from '../lib/cartStore';
import { getConfig } from '../lib/dataService';
import { useLang, getLang, t as tFn } from '../lib/i18n';
import { getDayCapacity, isLocoBlockedByFishing, getCapacityColor, checkFishingCapacity, getOffshoreCalendarBlockedDates } from '../lib/capacityService';
import { getBlockedFishingDates } from '../lib/syncService';


import IslandFoodSection from './IslandFoodSection';
import ActivityIconGrid from './ActivityIconGrid';


const { width } = Dimensions.get('window');

// ─── Kayak Options ───
interface KayakOption {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  details: string;
}

// ─── Water Activities Data ───
interface WaterItem {
  id: string;
  name: string;
  name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  priceLabel: string;
  image: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  color: string;
  details: string[];
  details_es?: string[];
}

// ─── Island Activities Data ───
interface IslandItem {
  id: string;
  name: string;
  name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  priceLabel: string;
  image: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  color: string;
  details: string[];
  details_es?: string[];
  galleryImages?: string[];
}


// ─── UI metadata (icons/colors not in config) ───
const WATER_ICON_MAP: Record<string, { icon: string; iconLib: 'ion' | 'mci'; color: string }> = {
  'transparent_kayak': { icon: 'eye', iconLib: 'ion', color: '#7C3AED' },
  'snorkel': { icon: 'glasses', iconLib: 'ion', color: '#0891B2' },
  'towing': { icon: 'speedometer', iconLib: 'ion', color: '#DC2626' },
  'sup': { icon: 'man', iconLib: 'ion', color: '#0D9488' },
  'surfing': { icon: 'trending-up', iconLib: 'ion', color: '#EA580C' },
  'windsurf': { icon: 'sail-boat', iconLib: 'mci', color: '#7C3AED' },
};

const ISLAND_ICON_MAP: Record<string, { icon: string; iconLib: 'ion' | 'mci'; color: string }> = {
  'chill_gym': { icon: 'fitness', iconLib: 'ion', color: '#0D9488' },

  'jungle_trail': { icon: 'trail-sign', iconLib: 'ion', color: '#15803D' },
  'coconut_workshop': { icon: 'leaf', iconLib: 'ion', color: '#16A34A' },
  'offgrid_workshop': { icon: 'sunny', iconLib: 'ion', color: '#EA580C' },
};

// ─── Config → Component Data Mappers ───

function getWaterItemsFromConfig(): WaterItem[] {
  const config = getConfig();
  if (!config || config.water.length === 0) return [];
  // Skip kayaks item (handled separately)
  return config.water
    .filter(w => !w.kayak_options || w.kayak_options.length === 0)
    .map(w => {
      const iconMeta = WATER_ICON_MAP[w.id] || { icon: 'water', iconLib: 'ion' as const, color: '#0D9488' };
      return {
        id: w.id,
        name: w.name,
        name_es: w.name_es,
        description: w.description,
        description_es: w.description_es,
        price: w.price,
        priceLabel: w.price_label,
        image: w.image,
        icon: iconMeta.icon,
        iconLib: iconMeta.iconLib,
        color: iconMeta.color,
        details: w.details,
        details_es: w.details_es,
      };
    });
}

function getKayakOptionsFromConfig(): { kayakItem: any; options: KayakOption[] } | null {
  const config = getConfig();
  if (!config) return null;
  const kayakItem = config.water.find(w => w.kayak_options && w.kayak_options.length > 0);
  if (!kayakItem || !kayakItem.kayak_options) return null;
  return {
    kayakItem,
    options: kayakItem.kayak_options.map(k => ({
      id: k.id,
      name: k.name,
      price: k.price,
      priceLabel: k.priceLabel,
      details: k.details,
    })),
  };
}

function getIslandItemsFromConfig(): IslandItem[] {
  const config = getConfig();
  if (!config || config.island.length === 0) return [];
  return config.island.map(i => {
    const iconMeta = ISLAND_ICON_MAP[i.id] || { icon: 'leaf', iconLib: 'ion' as const, color: '#16A34A' };
    return {
      id: i.id,
      name: i.name,
      name_es: i.name_es,
      description: i.description,
      description_es: i.description_es,
      price: i.price,
      priceLabel: i.price_label,
      image: i.image,
      icon: iconMeta.icon,
      iconLib: iconMeta.iconLib,
      color: iconMeta.color,
      details: i.details,
      details_es: i.details_es,
      galleryImages: i.gallery.length > 0 ? i.gallery : undefined,
    };
  });
}

function getOvernightItemFromConfig(): IslandItem | null {
  const config = getConfig();
  if (!config || !config.overnight) return null;
  const o = config.overnight;
  return {
    id: 'island-stay',
    name: o.name,
    name_es: o.name_es,
    description: o.description,
    description_es: o.description_es,
    price: o.price,
    priceLabel: o.price_label,
    image: o.image,
    icon: 'bed',
    iconLib: 'mci',
    color: '#7C3AED',
    details: o.details,
    details_es: o.details_es,
    galleryImages: o.gallery.map(g => g.url),
  };
}

function getFishingConfigData() {
  const config = getConfig();
  if (!config || !config.fishing) return null;
  return {
    centralImage: config.fishing.central_image,
    introText: config.fishing.intro_text,
    items: config.fishing.items,
  };
}

function getIntroTexts() {
  const config = getConfig();
  const isEs = getLang() === 'es';
  return {
    water: isEs
      ? (config?.waterIntroTextEs || config?.waterIntroText || '')
      : (config?.waterIntroText || ''),
    island: isEs
      ? (config?.islandIntroTextEs || config?.islandIntroText || '')
      : (config?.islandIntroText || ''),
  };
}







// ─── Fishing icon config ───
const INSHORE_CONFIG = { icon: 'fish', lib: 'ion' as const, color: '#2563EB', bgColor: '#EFF6FF', subtitle: 'Island rocky spots & bay currents', displayName: 'Inshore' };
const OFFSHORE_CONFIG = { icon: 'boat', lib: 'ion' as const, color: '#0369A1', bgColor: '#E0F2FE', subtitle: 'Blue water Dorado & Yellowfins', displayName: 'Offshore' };
const BIGGAME_CONFIG = { icon: 'trophy', lib: 'ion' as const, color: '#D97706', bgColor: '#FEF3C7', subtitle: 'Marlin, sailfish & giant tuna', displayName: 'Big Game' };

const fishingIcons: Record<string, { icon: string; lib: 'ion' | 'mci'; color: string; bgColor: string; subtitle: string; displayName: string }> = {
  'Inshore Fishing': INSHORE_CONFIG,
  'Reef Fishing': INSHORE_CONFIG, // legacy alias
  'Offshore Fishing': OFFSHORE_CONFIG,
  'Big Game Fishing': BIGGAME_CONFIG,
};

// ─── Fishing Overrides — NOW reads from config, NO hardcoded data ───
// Uses config's included, included_es, description, description_es, price, equipment, equipment_es, angler_cost
function getFishingOverrides(): Record<string, { price?: number; description?: string; included?: string[]; anglerCost?: number; equipment?: string[] }> {
  const config = getConfig();
  const isEs = getLang() === 'es';
  const overrides: Record<string, { price?: number; description?: string; included?: string[]; anglerCost?: number; equipment?: string[] }> = {};

  if (!config || !config.fishing) return overrides;

  for (const item of config.fishing.items) {
    const override: any = {};
    // Use config price
    if (item.price) override.price = item.price;
    // Use config description (translated)
    const desc = (isEs && item.description_es) ? item.description_es : item.description;
    if (desc) override.description = desc;
    // Use config included (translated)
    const included = (isEs && item.included_es && item.included_es.length > 0) ? item.included_es : item.included;
    if (included && included.length > 0) override.included = included;
    // Use config equipment (translated)
    const equipment = (isEs && item.equipment_es && item.equipment_es.length > 0) ? item.equipment_es : item.equipment;
    if (equipment && equipment.length > 0) override.equipment = equipment;
    // Use config angler_cost
    if (item.angler_cost) override.anglerCost = item.angler_cost;

    overrides[item.name] = override;
  }

  return overrides;
}

// Central fishing image — from config, NO hardcoded URL
function getFishingCentralImage(): string {
  const config = getConfig();
  return config?.fishing?.central_image || '';
}





// Sorting order for fishing activities — Inshore first
const FISHING_SORT_ORDER: Record<string, number> = {
  'Inshore Fishing': 0,
  'Reef Fishing': 0, // legacy alias
  'Offshore Fishing': 1,
  'Big Game Fishing': 2,
};

// ─── Date helpers for fishing calendar ───
function fishingPrevDay(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fishingNextDay(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}





// ─── Kayaks Card Component (reads from config) ───
function KayaksCard({ onAdd, configRefreshKey }: { onAdd: (name: string, price: number, image: string) => void; configRefreshKey?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedKayaks, setSelectedKayaks] = useState<string[]>([]);
  const { t, lang } = useLang();
  const isEs = lang === 'es';

  // Re-read config when configRefreshKey changes (config was reloaded)
  const kayakData = useMemo(() => getKayakOptionsFromConfig(), [configRefreshKey]);
  const KAYAK_OPTIONS = kayakData?.options || [];
  const kayakImage = kayakData?.kayakItem?.image || 'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1771003933333_33bb00f5.jpeg';
  const kayakName = (isEs && kayakData?.kayakItem?.name_es) ? kayakData.kayakItem.name_es : (kayakData?.kayakItem?.name || 'Kayaks');
  const kayakDesc = (isEs && kayakData?.kayakItem?.description_es) ? kayakData.kayakItem.description_es : (kayakData?.kayakItem?.description || '3 kayaks available + free kids kayak. Choose one or multiple!');
  const kayakPriceLabel = kayakData?.kayakItem?.price_label || 'from $15 / 2hr';


  const toggleKayak = (id: string) => {
    setSelectedKayaks(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  };

  const totalPrice = selectedKayaks.reduce((sum, id) => {
    const k = KAYAK_OPTIONS.find(o => o.id === id);
    return sum + (k?.price || 0);
  }, 0);

  const handleAddToCart = () => {
    if (selectedKayaks.length === 0) return;
    const names = selectedKayaks.map(id => KAYAK_OPTIONS.find(o => o.id === id)?.name || '').join(', ');
    onAdd(`Kayak: ${names}`, totalPrice, kayakImage);
    setSelectedKayaks([]);
    setExpanded(false);
  };

  if (KAYAK_OPTIONS.length === 0) return null;

  return (
    <View style={cardS.card}>
      <TouchableOpacity style={cardS.mainRow} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <Image source={{ uri: kayakImage }} style={cardS.image} />
        <View style={cardS.info}>
          <Text style={cardS.name}>{kayakName}</Text>
          <Text style={cardS.desc} numberOfLines={2}>{kayakDesc}</Text>
          <View style={cardS.bottomRow}>
            <Text style={cardS.price}>{kayakPriceLabel}</Text>
            <View style={cardS.expandIcon}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={cardS.expandedSection}>
          <Text style={kayakS.selectLabel}>{t('select_kayaks')}</Text>
          {KAYAK_OPTIONS.map((kayak) => {
            const isSelected = selectedKayaks.includes(kayak.id);
            return (
              <TouchableOpacity
                key={kayak.id}
                style={[kayakS.option, isSelected && kayakS.optionSelected]}
                onPress={() => toggleKayak(kayak.id)}
                activeOpacity={0.7}
              >
                <View style={kayakS.checkboxOuter}>
                  {isSelected ? (
                    <View style={kayakS.checkboxInner}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  ) : (
                    <View style={kayakS.checkboxEmpty} />
                  )}
                </View>
                <View style={kayakS.optionInfo}>
                  <Text style={[kayakS.optionName, isSelected && { color: '#0D9488' }]}>{kayak.name}</Text>
                  <Text style={kayakS.optionDetails}>{kayak.details}</Text>
                </View>
                <Text style={[kayakS.optionPrice, kayak.price === 0 && { color: '#059669' }]}>
                  {kayak.price === 0 ? t('free') : kayak.priceLabel}
                </Text>
              </TouchableOpacity>
            );
          })}

          {selectedKayaks.length > 0 && (
            <View style={kayakS.summary}>
              <Text style={kayakS.summaryText}>
                {t('kayaks_selected', { count: selectedKayaks.length })}
              </Text>
              <Text style={kayakS.summaryPrice}>${totalPrice}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[cardS.addBtn, { backgroundColor: '#0D9488', opacity: selectedKayaks.length > 0 ? 1 : 0.4 }]}
            onPress={handleAddToCart}
            activeOpacity={0.8}
            disabled={selectedKayaks.length === 0}
          >
            <Ionicons name="cart" size={16} color="#fff" />
            <Text style={cardS.addBtnText}>
              {selectedKayaks.length > 0 ? t('add_to_cart_dash', { price: String(totalPrice) }) : t('select_kayak_first')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}



const kayakS = StyleSheet.create({
  selectLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    backgroundColor: '#F8FAFC', marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent',
  },
  optionSelected: { borderColor: '#0D9488', backgroundColor: '#F0FDFA' },
  checkboxOuter: { marginRight: 10 },
  checkboxInner: {
    width: 22, height: 22, borderRadius: 6, backgroundColor: '#0D9488',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxEmpty: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1',
  },
  optionInfo: { flex: 1 },
  optionName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  optionDetails: { fontSize: 11, color: '#64748B', marginTop: 2 },
  optionPrice: { fontSize: 13, fontWeight: '800', color: '#0D9488', marginLeft: 8 },
  summary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDFA', borderRadius: 10, padding: 10, marginTop: 6, marginBottom: 10,
  },
  summaryText: { fontSize: 13, fontWeight: '600', color: '#0D9488' },
  summaryPrice: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
});
// ─── Generic Expandable Card ───
// ─── Generic Expandable Card (with translation support) ───
function ActivityItemCard({ item, onAdd }: {
  item: WaterItem | IslandItem;
  onAdd: (name: string, price: number, image: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const { t, lang } = useLang();
  const isEs = lang === 'es';
  const isFree = item.price === 0;
  const gallery = ('galleryImages' in item && item.galleryImages) ? item.galleryImages : null;

  // Resolve translated fields
  const displayName = (isEs && item.name_es) ? item.name_es : item.name;
  const displayDesc = (isEs && item.description_es) ? item.description_es : item.description;
  const displayDetails = (isEs && item.details_es && item.details_es.length > 0) ? item.details_es : item.details;

  return (
    <View style={cardS.card}>
      <TouchableOpacity style={cardS.mainRow} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <Image source={{ uri: item.image }} style={cardS.image} />
        <View style={cardS.info}>
          <Text style={cardS.name} numberOfLines={1}>{displayName}</Text>
          <Text style={cardS.desc} numberOfLines={2}>{displayDesc}</Text>
          <View style={cardS.bottomRow}>
            {isFree ? (
              <View style={cardS.freeBadge}><Text style={cardS.freeText}>{t('free')}</Text></View>
            ) : (
              <Text style={cardS.price}>{item.priceLabel}</Text>
            )}
            <View style={cardS.expandIcon}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={cardS.expandedSection}>
          {/* Gallery for items with multiple images */}
          {gallery && gallery.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cardS.galleryScroll} contentContainerStyle={cardS.galleryRow}>
              {gallery.map((img, idx) => (
                <TouchableOpacity key={idx} onPress={() => setGalleryIdx(idx)} activeOpacity={0.8}>
                  <Image
                    source={{ uri: img }}
                    style={[cardS.galleryThumb, galleryIdx === idx && cardS.galleryThumbActive]}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {gallery && gallery.length > 1 && (
            <Image source={{ uri: gallery[galleryIdx] }} style={cardS.galleryMain} resizeMode="cover" />
          )}

          <View style={cardS.detailsGrid}>
            {displayDetails.map((detail, idx) => (
              <View key={idx} style={cardS.detailRow}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={cardS.detailText}>{detail}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[cardS.addBtn, { backgroundColor: item.color }]}
            onPress={() => {
              onAdd(item.name, item.price, item.image);
              setExpanded(false);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="cart" size={16} color="#fff" />
            <Text style={cardS.addBtnText}>
              {isFree ? t('reserve_free') : t('add_to_cart_dash', { price: String(item.priceLabel.replace(/[^0-9.]/g, '')) })}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}



// ─── Calendar Helper (for overnight) ───
const getCalendarMonths = (monthsAhead: number) => {
  const months: { year: number; month: number; label: string; days: { day: number; date: string; isPast: boolean; isToday: boolean }[] }[] = [];
  const today = new Date();
  const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
  
  for (let m = 0; m < monthsAhead; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = d.getDay();
    
    const days: { day: number; date: string; isPast: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: 0, date: '', isPast: true, isToday: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = dateObj.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      days.push({ day, date: dateStr, isPast, isToday });
    }
    months.push({ year, month, label, days });
  }
  return months;
};


// ─── Overnight Pricing Helper (same as BeachBookingCard) ───
// 1st night $100, 2nd night +$50 (50% off), 3rd+ nights +$30 each (70% off)
function calcOvernightTotal(nights: number): number {
  if (nights <= 0) return 0;
  let total = 100; // 1st night
  if (nights >= 2) total += 50; // 2nd night
  if (nights >= 3) total += (nights - 2) * 30; // 3rd+ nights
  return total;
}

function getOvernightBreakdown(nights: number): string {
  if (nights === 1) return tFn('overnight_breakdown_1');
  if (nights === 2) return tFn('overnight_breakdown_2');
  return tFn('overnight_breakdown_n', { n: String(nights - 2), total: String(calcOvernightTotal(nights)) });
}


// ─── Overnight Stay Card (special layout with calendar) ───
function OvernightStayCard({ item, onAdd, showToast }: {
  item: IslandItem;
  onAdd: (name: string, price: number, image: string, date?: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [nights, setNights] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(0);
  const { t, lang } = useLang();
  const gallery = item.galleryImages || [];
  const calendarMonths = getCalendarMonths(3);

  const galleryLabels = [
    t('gl_main_rancho'), t('gl_bungalow_inside'), t('gl_bungalow_outside'),
    t('gl_shower_entrance'), t('gl_shower_inside'), t('gl_kitchen_hut'),
    t('gl_kitchen_inside'), t('gl_wash_area'), t('gl_dining_area'), t('gl_covered_seating'),
  ];

  const calDayNames = [t('cal_su'), t('cal_mo'), t('cal_tu'), t('cal_we'), t('cal_th'), t('cal_fr'), t('cal_sa')];

  const totalPrice = calcOvernightTotal(nights);

  const handleBook = () => {
    if (!selectedDate) {
      showToast(t('please_select_checkin'), 'error');
      return;
    }
    onAdd(
      tFn('overnight_cart_item', { name: item.name, nights: String(nights), date: selectedDate }),

      totalPrice,
      item.image,
      selectedDate,
    );
  };

  return (
    <View style={overnightS.card}>
      <Image source={{ uri: item.image }} style={overnightS.heroImage} resizeMode="cover" />
      <View style={overnightS.heroBadge}>
        <MaterialCommunityIcons name="sleep" size={14} color="#fff" />
        <Text style={overnightS.heroBadgeText}>{t('overnight_badge')}</Text>
      </View>

      <View style={overnightS.content}>
        <Text style={overnightS.title}>{item.name}</Text>
        <Text style={overnightS.price}>{item.priceLabel}</Text>

        <View style={overnightS.pitchBanner}>
          <MaterialCommunityIcons name="information-outline" size={16} color="#7C3AED" />
          <Text style={overnightS.pitchText}>{t('overnight_pitch')}</Text>
        </View>

        <View style={overnightS.highlightRow}>
          {[
            { icon: 'bed-outline' as const, labelKey: 'beds_pillows' },
            { icon: 'silverware-fork-knife' as const, labelKey: 'full_kitchen' },
            { icon: 'shower-head' as const, labelKey: 'shower' },
            { icon: 'wifi' as const, labelKey: 'internet' },
          ].map((h, i) => (
            <View key={i} style={overnightS.highlight}>
              <View style={overnightS.highlightIcon}>
                <MaterialCommunityIcons name={h.icon} size={18} color="#7C3AED" />
              </View>
              <Text style={overnightS.highlightLabel}>{t(h.labelKey)}</Text>
            </View>
          ))}
        </View>

        <Text style={overnightS.sectionLabel}>{t('sleeping_options')}</Text>
        <View style={overnightS.sleepOptions}>
          {[
            { nameKey: 'ranchito', descKey: 'ranchito_desc', icon: 'home-outline' as const },
            { nameKey: 'bungalow', descKey: 'bungalow_desc', icon: 'home-group' as const },
            { nameKey: 'tree_tent', descKey: 'tree_tent_desc', icon: 'pine-tree' as const },
          ].map((opt, i) => (
            <View key={i} style={overnightS.sleepOption}>
              <MaterialCommunityIcons name={opt.icon} size={20} color="#7C3AED" />
              <View style={overnightS.sleepOptionInfo}>
                <Text style={overnightS.sleepOptionName}>{t(opt.nameKey)}</Text>
                <Text style={overnightS.sleepOptionDesc}>{t(opt.descKey)}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={overnightS.expandToggle}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text style={overnightS.expandToggleText}>
            {expanded ? t('hide_photos') : t('see_photos')}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#7C3AED" />
        </TouchableOpacity>

        {expanded && (
          <View style={overnightS.expandedContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={overnightS.galleryScroll}>
              {gallery.map((img, idx) => (
                <TouchableOpacity key={idx} onPress={() => setGalleryIdx(idx)} activeOpacity={0.8}>
                  <View style={[overnightS.galleryThumbWrap, galleryIdx === idx && overnightS.galleryThumbWrapActive]}>
                    <Image source={{ uri: img }} style={overnightS.galleryThumb} />
                    <Text style={overnightS.galleryThumbLabel} numberOfLines={1}>
                      {galleryLabels[idx] || t('photo_label', { num: String(idx + 1) })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Image source={{ uri: gallery[galleryIdx] || item.image }} style={overnightS.galleryMain} resizeMode="cover" />
            <Text style={overnightS.galleryCaption}>{galleryLabels[galleryIdx] || ''}</Text>

            <View style={overnightS.honestBox}>
              <Text style={overnightS.honestTitle}>{t('what_to_expect')}</Text>
              <Text style={overnightS.honestText}>{t('what_to_expect_text')}</Text>
            </View>

            <Text style={overnightS.detailsTitle}>{t('everything_included')}</Text>
            <View style={overnightS.detailsGrid}>
              {item.details.map((detail, idx) => (
                <View key={idx} style={overnightS.detailRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={overnightS.detailText}>{detail}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Nights selector ─── */}
        <Text style={overnightS.sectionLabel}>{t('number_of_nights')}</Text>
        <View style={overnightS.nightsRow}>
          <TouchableOpacity style={overnightS.nightsBtn} onPress={() => setNights(Math.max(1, nights - 1))}>
            <Ionicons name="remove" size={16} color="#7C3AED" />
          </TouchableOpacity>
          <Text style={overnightS.nightsText}>{nights}</Text>
          <TouchableOpacity style={overnightS.nightsBtn} onPress={() => setNights(Math.min(14, nights + 1))}>
            <Ionicons name="add" size={16} color="#7C3AED" />
          </TouchableOpacity>
          <Text style={overnightS.nightsTotal}>${totalPrice}</Text>
        </View>

        {/* Discount breakdown */}
        {nights >= 2 && (
          <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D', marginBottom: 4 }}>{t('multi_night_discount')}</Text>
            <Text style={{ fontSize: 11, color: '#166534', lineHeight: 16 }}>
              {getOvernightBreakdown(nights)}
            </Text>
            <Text style={{ fontSize: 10, color: '#166534', marginTop: 4, fontStyle: 'italic' }}>
              {t('discount_detail')}
            </Text>
          </View>
        )}

        {/* ─── Calendar for check-in date ─── */}
        <Text style={overnightS.sectionLabel}>{t('checkin_date')}</Text>
        <View style={overnightS.calendarContainer}>
          <View style={overnightS.calendarNav}>
            <TouchableOpacity
              style={[overnightS.calNavBtn, calendarMonth === 0 && { opacity: 0.3 }]}
              onPress={() => setCalendarMonth(Math.max(0, calendarMonth - 1))}
              disabled={calendarMonth === 0}
            >
              <Ionicons name="chevron-back" size={16} color="#7C3AED" />
            </TouchableOpacity>
            <Text style={overnightS.calMonthLabel}>{calendarMonths[calendarMonth]?.label}</Text>
            <TouchableOpacity
              style={[overnightS.calNavBtn, calendarMonth >= calendarMonths.length - 1 && { opacity: 0.3 }]}
              onPress={() => setCalendarMonth(Math.min(calendarMonths.length - 1, calendarMonth + 1))}
              disabled={calendarMonth >= calendarMonths.length - 1}
            >
              <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
            </TouchableOpacity>
          </View>

          <View style={overnightS.calWeekRow}>
            {calDayNames.map(d => (
              <Text key={d} style={overnightS.calWeekDay}>{d}</Text>
            ))}
          </View>

          <View style={overnightS.calDaysGrid}>
            {calendarMonths[calendarMonth]?.days.map((day, idx) => {
              if (day.day === 0) {
                return <View key={`empty-${idx}`} style={overnightS.calDayCell} />;
              }
              const isDateSelected = selectedDate === day.date;
              const isDisabled = day.isPast;
              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    overnightS.calDayCell,
                    isDateSelected && overnightS.calDayCellSelected,
                    day.isToday && !isDateSelected && overnightS.calDayCellToday,
                  ]}
                  onPress={() => !isDisabled && setSelectedDate(day.date)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    overnightS.calDayText,
                    isDateSelected && overnightS.calDayTextSelected,
                    isDisabled && overnightS.calDayTextDisabled,
                    day.isToday && !isDateSelected && overnightS.calDayTextToday,
                  ]}>
                    {day.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDate ? (
            <View style={overnightS.selectedDateBadge}>
              <Ionicons name="calendar" size={14} color="#7C3AED" />
              <Text style={overnightS.selectedDateBadgeText}>
                {t('select_checkin', { date: selectedDate, nights: String(nights) })}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[overnightS.bookBtn, !selectedDate && { opacity: 0.5 }]}
          onPress={handleBook}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="sleep" size={18} color="#fff" />
          <Text style={overnightS.bookBtnText}>
            {t('book_island_stay', { price: String(totalPrice), nights: String(nights) })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}




const overnightS = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  heroImage: { width: '100%', height: 200 },
  heroBadge: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(124,58,237,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  price: { fontSize: 16, fontWeight: '700', color: '#7C3AED', marginBottom: 12 },
  pitchBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  pitchText: { flex: 1, fontSize: 13, color: '#5B21B6', lineHeight: 19 },
  highlightRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  highlight: { alignItems: 'center', flex: 1 },
  highlightIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5F3FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  highlightLabel: { fontSize: 11, fontWeight: '600', color: '#475569', textAlign: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  sleepOptions: { gap: 8, marginBottom: 14 },
  sleepOption: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FAFBFC', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  sleepOptionInfo: { flex: 1 },
  sleepOptionName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  sleepOptionDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  expandToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginBottom: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  expandToggleText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  expandedContent: { marginBottom: 12 },
  galleryScroll: { marginBottom: 10 },
  galleryThumbWrap: {
    marginRight: 8, alignItems: 'center', borderRadius: 10, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
  },
  galleryThumbWrapActive: { borderColor: '#7C3AED' },
  galleryThumb: { width: 72, height: 54, borderRadius: 8 },
  galleryThumbLabel: { fontSize: 9, color: '#64748B', marginTop: 3, fontWeight: '500', maxWidth: 72, textAlign: 'center' },
  galleryMain: { width: '100%', height: 200, borderRadius: 14, marginBottom: 6 },
  galleryCaption: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 14, fontStyle: 'italic' },
  honestBox: {
    backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#FEF3C7',
  },
  honestTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 6 },
  honestText: { fontSize: 13, color: '#78350F', lineHeight: 19 },
  detailsTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  detailsGrid: { gap: 6, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailText: { fontSize: 13, color: '#475569', flex: 1, lineHeight: 18 },

  // Nights selector
  nightsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12, marginBottom: 14,
  },
  nightsBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
  nightsText: {
    fontSize: 22, fontWeight: '800', color: '#5B21B6', minWidth: 28, textAlign: 'center',
  },
  nightsTotal: {
    fontSize: 18, fontWeight: '800', color: '#7C3AED', marginLeft: 'auto',
  },

  // Calendar
  calendarContainer: {
    backgroundColor: '#F5F3FF', borderRadius: 16, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#EDE9FE',
  },
  calendarNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  calNavBtn: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: '#5B21B6' },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekDay: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94A3B8',
  },
  calDaysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
  },
  calDayCellSelected: { backgroundColor: '#7C3AED', borderRadius: 10 },
  calDayCellToday: { backgroundColor: '#EDE9FE', borderRadius: 10 },
  calDayText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  calDayTextSelected: { color: '#fff', fontWeight: '800' },
  calDayTextDisabled: { color: '#CBD5E1' },
  calDayTextToday: { color: '#7C3AED', fontWeight: '800' },
  selectedDateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EDE9FE', borderRadius: 8, padding: 8, marginTop: 8,
    alignSelf: 'flex-start',
  },
  selectedDateBadgeText: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },

  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7C3AED', paddingVertical: 14, borderRadius: 14, gap: 8,
  },
  bookBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});


const cardS = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, overflow: 'hidden',
  },
  mainRow: { flexDirection: 'row' },
  image: { width: 100, height: 100 },
  info: { flex: 1, padding: 12, justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  desc: { fontSize: 11, color: '#64748B', lineHeight: 15, marginTop: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  price: { fontSize: 13, fontWeight: '700', color: '#0D9488' },
  freeBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  freeText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  expandIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  expandedSection: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailsGrid: { marginTop: 10, gap: 6, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, color: '#475569' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 8,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  galleryScroll: { marginTop: 10, marginBottom: 8 },
  galleryRow: { gap: 6 },
  galleryThumb: { width: 56, height: 42, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  galleryThumbActive: { borderColor: '#0D9488' },
  galleryMain: { width: '100%', height: 150, borderRadius: 12, marginBottom: 8 },
});

// ─── Fishing Tab Content (with calendars for Offshore/Big Game, inshore redirect) ───
function FishingTabContent({ fishingActivities, onBook, onBookInshore, onOpenCart }: {
  fishingActivities: Activity[];
  onBook: (activity: Activity) => void;
  onBookInshore?: () => void;
  onOpenCart?: () => void;
}) {
  const { addItem } = useCart();
  const { t } = useLang();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [anglerCounts, setAnglerCounts] = useState<Record<number, number>>({});
  const [selectedDates, setSelectedDates] = useState<Record<number, string>>({});
  const [calMonthIdx, setCalMonthIdx] = useState<Record<number, number>>({});
  const calendarData = getCalendarMonths(3);
  const calDayNames = [t('cal_su'), t('cal_mo'), t('cal_tu'), t('cal_we'), t('cal_th'), t('cal_fr'), t('cal_sa')];

  const getAnglers = (id: number) => anglerCounts[id] || 1;
  const setAnglers = (id: number, count: number) => {
    setAnglerCounts(prev => ({ ...prev, [id]: Math.max(1, Math.min(count, 8)) }));
  };
  const isInshore = (name: string) => name === 'Inshore Fishing' || name === 'Reef Fishing';
  const isOffshoreOrBigGame = (name: string) => name === 'Offshore Fishing' || name === 'Big Game Fishing';
  const sortedActivities = [...fishingActivities].sort((a, b) => (FISHING_SORT_ORDER[a.name] ?? 99) - (FISHING_SORT_ORDER[b.name] ?? 99));

  // ═══ OFFSHORE/BIGGAME CALENDAR — simpler blocking (fishing day + next day only) ═══
  // Does NOT block: day before fishing, overnight dates (offshore exception)
  const offshoreBlockedMap = getOffshoreCalendarBlockedDates();

  const handleAddToCart = (activity: Activity) => {
    const override = getFishingOverrides()[activity.name];
    const basePrice = (override?.price ?? Number(activity.price)) || 0;
    const date = selectedDates[activity.id] || '';
    if (!date) return;

    // SAFETY: block if date is in the offshore blocked map
    const freshBlocked = getOffshoreCalendarBlockedDates();
    if (freshBlocked[date]) return;
    // Note: we do NOT check overnightBooked here — offshore/biggame can be booked
    // even when there's a regular overnight (exception per rules)
    const fishCheck = checkFishingCapacity(date, getAnglers(activity.id), activity.name);
    if (!fishCheck.canBook) return;


    const anglers = getAnglers(activity.id);
    const anglerCost = override?.anglerCost || 0;
    const extraAnglersCost = Math.max(0, anglers - 1) * anglerCost;
    const total = basePrice + extraAnglersCost;
    const extraStr = anglers > 1 ? ` + ${anglers - 1} extra angler${anglers > 1 ? 's' : ''}` : '';
    addItem({ id: `fishing-${activity.id}-${date}-${Date.now()}`, type: 'activity', name: `${activity.name}${extraStr} - ${date}`, price: total, quantity: 1, date, participants: anglers, image_url: activity.image_url });
    if (onOpenCart) onOpenCart();
  };

  if (sortedActivities.length === 0) {
    return (<View style={fishS.empty}><Ionicons name="fish-outline" size={48} color="#CBD5E1" /><Text style={fishS.emptyText}>{t('loading_fishing')}</Text></View>);
  }

  return (
    <View style={fishS.container}>
      <Image source={{ uri: getFishingCentralImage() }} style={fishS.centralImage} resizeMode="contain" />

      <View style={fishS.introBanner}>
        <MaterialCommunityIcons name="fish" size={18} color="#2563EB" />
        <Text style={fishS.introText}>{t('fishing_intro')}</Text>
      </View>

      {sortedActivities.map((activity) => {
        const cfg = fishingIcons[activity.name] || { icon: 'fish', lib: 'ion' as const, color: '#2563EB', bgColor: '#EFF6FF', subtitle: '', displayName: activity.name };
        const override = getFishingOverrides()[activity.name];

        const displayPrice = override?.price ?? Number(activity.price);
        const displayDesc = override?.description ?? activity.description;
        const isExpanded = expandedId === activity.id;
        const hasAnglerCost = override?.anglerCost != null;
        const anglerCost = override?.anglerCost || 0;
        const anglers = getAnglers(activity.id);
        const extraAnglersCost = hasAnglerCost ? Math.max(0, anglers - 1) * anglerCost : 0;
        const totalPrice = displayPrice + extraAnglersCost;
        const includedItems = override?.included || [];
        const displayName = cfg.displayName || activity.name;
        const equipmentList = override?.equipment || activity.equipment;
        const inshore = isInshore(activity.name);
        const offBig = isOffshoreOrBigGame(activity.name);
        const curMonth = calMonthIdx[activity.id] || 0;
        const curDate = selectedDates[activity.id] || '';

        // Compute whitelist for offshore/biggame: ONLY check fishing blocks (no overnight check)
        // Offshore/biggame can be booked even when there's a regular overnight (exception)
        const curDateOffshoreBlock = curDate ? offshoreBlockedMap[curDate] : undefined;
        const isSelectedDateWhitelisted = curDate
          ? !curDateOffshoreBlock
          : false;


        // Translated subtitles/names for fishing types
        const fishSubtitleMap: Record<string, string> = { 'Inshore': t('inshore_subtitle'), 'Offshore': t('offshore_subtitle'), 'Big Game': t('biggame_subtitle') };
        const fishNameMap: Record<string, string> = { 'Inshore': t('inshore'), 'Offshore': t('offshore'), 'Big Game': t('big_game') };
        const translatedName = fishNameMap[displayName] || displayName;
        const translatedSubtitle = fishSubtitleMap[displayName] || cfg.subtitle;

        return (
          <View key={activity.id} style={fishS.optionCard}>
            <TouchableOpacity style={fishS.optionHeader} onPress={() => setExpandedId(isExpanded ? null : activity.id)} activeOpacity={0.7}>
              <View style={[fishS.optionIcon, { backgroundColor: cfg.bgColor }]}>
                {cfg.lib === 'ion' ? <Ionicons name={cfg.icon as any} size={24} color={cfg.color} /> : <MaterialCommunityIcons name={cfg.icon as any} size={24} color={cfg.color} />}
              </View>
              <View style={fishS.optionInfo}>
                <Text style={fishS.optionName}>{translatedName}</Text>
                <Text style={fishS.optionSubtitle}>{translatedSubtitle}</Text>
                <View style={fishS.optionMeta}>
                  <View style={fishS.metaItem}><Ionicons name="time-outline" size={12} color="#94A3B8" /><Text style={fishS.metaText}>{activity.duration}</Text></View>
                  <View style={fishS.metaItem}><Ionicons name="people-outline" size={12} color="#94A3B8" /><Text style={fishS.metaText}>{t('max_label', { max: String(activity.max_participants) })}</Text></View>
                </View>
              </View>
              <View style={fishS.optionRight}>
                {/* Price hidden here — only shown when expanded & selecting anglers */}
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={fishS.expandedSection}>
                <Text style={fishS.expandedDesc}>{displayDesc}</Text>
                {includedItems.length > 0 && (<><Text style={fishS.expandedLabel}>{t('included')}</Text><View style={fishS.equipGrid}>{includedItems.map((item: string, idx: number) => (<View key={idx} style={fishS.equipItem}><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={fishS.equipText}>{item}</Text></View>))}</View></>)}
                {includedItems.length === 0 && equipmentList && equipmentList.length > 0 && (<><Text style={fishS.expandedLabel}>{t('equipment_included')}</Text><View style={fishS.equipGrid}>{equipmentList.map((item: string, idx: number) => (<View key={idx} style={fishS.equipItem}><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={fishS.equipText}>{item}</Text></View>))}</View></>)}

                {inshore && (
                  <View>
                    <View style={fishS.inshoreNote}><Ionicons name="information-circle" size={16} color="#2563EB" /><Text style={fishS.inshoreNoteText}>{t('inshore_note')}</Text></View>
                    <TouchableOpacity style={[fishS.bookButton, { backgroundColor: '#2563EB' }]} onPress={() => { if (onBookInshore) onBookInshore(); }} activeOpacity={0.8}>
                      <Ionicons name="boat" size={16} color="#fff" /><Text style={fishS.bookText}>{t('book_with_boat')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {offBig && (
                  <View>
                    {hasAnglerCost && (
                      <View style={fishS.anglersSection}>
                        <Text style={fishS.anglersLabel}>{t('number_of_anglers')}</Text>
                        <Text style={fishS.anglersNote}>{t('first_angler_included', { cost: String(anglerCost) })}</Text>
                        <View style={fishS.anglersRow}>
                          <TouchableOpacity style={fishS.anglersBtn} onPress={() => setAnglers(activity.id, anglers - 1)}><Ionicons name="remove" size={16} color="#2563EB" /></TouchableOpacity>
                          <Text style={fishS.anglersCount}>{anglers}</Text>
                          <TouchableOpacity style={fishS.anglersBtn} onPress={() => setAnglers(activity.id, anglers + 1)}><Ionicons name="add" size={16} color="#2563EB" /></TouchableOpacity>
                          {anglers > 1 && <Text style={fishS.anglersExtra}>+${extraAnglersCost} ({anglers - 1} extra)</Text>}
                        </View>
                        <View style={fishS.anglersTotalRow}><Text style={fishS.anglersTotalLabel}>{t('trip_total')}</Text><Text style={fishS.anglersTotalPrice}>${totalPrice}</Text></View>
                      </View>
                    )}
                    <Text style={fishS.expandedLabel}>{t('select_date')}</Text>
                    <View style={fishS.calContainer}>
                      <View style={fishS.calNav}>
                        <TouchableOpacity style={[fishS.calNavBtn, curMonth === 0 && { opacity: 0.3 }]} onPress={() => setCalMonthIdx({ ...calMonthIdx, [activity.id]: Math.max(0, curMonth - 1) })} disabled={curMonth === 0}><Ionicons name="chevron-back" size={16} color={cfg.color} /></TouchableOpacity>
                        <Text style={fishS.calMonthLabel}>{calendarData[curMonth]?.label}</Text>
                        <TouchableOpacity style={[fishS.calNavBtn, curMonth >= 2 && { opacity: 0.3 }]} onPress={() => setCalMonthIdx({ ...calMonthIdx, [activity.id]: Math.min(2, curMonth + 1) })} disabled={curMonth >= 2}><Ionicons name="chevron-forward" size={16} color={cfg.color} /></TouchableOpacity>
                      </View>
                      <View style={fishS.calWeekRow}>{calDayNames.map(d => <Text key={d} style={fishS.calWeekDay}>{d}</Text>)}</View>
                      {/* ═══ OFFSHORE/BIGGAME CALENDAR — highlights arrival (X-1), fishing (X), departure (X+1) ═══ */}
                      <View style={fishS.calDaysGrid}>
                        {(() => {
                          // Compute arrival/departure dates from selected fishing day
                          const arrivalDate = curDate ? fishingPrevDay(curDate) : '';
                          const departureDate = curDate ? fishingNextDay(curDate) : '';
                          return calendarData[curMonth]?.days.map((day, idx) => {
                            if (day.day === 0) return <View key={`e-${idx}`} style={fishS.calDayCell} />;
                            const isFishingDay = curDate === day.date;
                            const isArrival = arrivalDate === day.date && !!curDate;
                            const isDeparture = departureDate === day.date && !!curDate;
                            const isPartOfTrip = isFishingDay || isArrival || isDeparture;
                            // Use OFFSHORE blocked map (fishing day + next day only)
                            const offshoreBlock = !day.isPast ? offshoreBlockedMap[day.date] : undefined;
                            const hasOffshoreBlock = !!offshoreBlock;
                            // Whitelisted = not past AND not in offshore block map
                            const isWhitelisted = !day.isPast && !hasOffshoreBlock;
                            const isDisabled = day.isPast || !isWhitelisted;
                            // Visual hints
                            const dayCap = !day.isPast ? getDayCapacity(day.date) : null;
                            const dayCapColor = !day.isPast ? getCapacityColor(day.date) : undefined;

                            // Determine background color
                            let bgStyle: any = {};
                            if (isFishingDay && isWhitelisted) {
                              bgStyle = { backgroundColor: cfg.color, borderRadius: 8 };
                            } else if (isArrival && !day.isPast) {
                              bgStyle = { backgroundColor: cfg.bgColor, borderRadius: 8, borderWidth: 1.5, borderColor: cfg.color };
                            } else if (isDeparture && !day.isPast) {
                              bgStyle = { backgroundColor: cfg.bgColor, borderRadius: 8, borderWidth: 1.5, borderColor: cfg.color };
                            } else if (hasOffshoreBlock && !day.isPast) {
                              bgStyle = { backgroundColor: '#FEE2E2', borderRadius: 8 };
                            } else if (day.isToday && !isFishingDay && isWhitelisted) {
                              bgStyle = { backgroundColor: '#F0FDFA', borderRadius: 8 };
                            }

                            // Determine text style
                            let textStyle: any = {};
                            if (isFishingDay && isWhitelisted) {
                              textStyle = { color: '#fff', fontWeight: '800' };
                            } else if ((isArrival || isDeparture) && !day.isPast) {
                              textStyle = { color: cfg.color, fontWeight: '800' };
                            } else if (day.isPast) {
                              textStyle = { color: '#CBD5E1' };
                            } else if (hasOffshoreBlock && !day.isPast) {
                              textStyle = { color: '#DC2626', fontWeight: '800', textDecorationLine: 'line-through' };
                            } else if (day.isToday && isWhitelisted) {
                              textStyle = { color: '#0D9488', fontWeight: '800' };
                            }

                            // Small label under the day number for arrival/fishing/departure
                            let dayLabel = '';
                            if (isFishingDay && isWhitelisted) dayLabel = '';
                            else if (isArrival && !day.isPast) dayLabel = '';
                            else if (isDeparture && !day.isPast) dayLabel = '';

                            return (
                              <TouchableOpacity
                                key={day.date}
                                style={[fishS.calDayCell, bgStyle]}
                                onPress={() => { if (!isDisabled) { setSelectedDates({ ...selectedDates, [activity.id]: day.date }); } }}
                                disabled={isDisabled}
                              >
                                <Text style={[fishS.calDayText, textStyle]}>{day.day}</Text>
                                {isFishingDay && isWhitelisted && (
                                  <MaterialCommunityIcons name="fish" size={8} color="#fff" />
                                )}
                                {isArrival && !day.isPast && (
                                  <Ionicons name="arrow-down" size={8} color={cfg.color} />
                                )}
                                {isDeparture && !day.isPast && (
                                  <Ionicons name="arrow-up" size={8} color={cfg.color} />
                                )}
                                {hasOffshoreBlock && !day.isPast && !isPartOfTrip && (
                                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#DC2626', marginTop: 1 }} />
                                )}
                                {!hasOffshoreBlock && !isPartOfTrip && dayCap && dayCap.bookedPersons > 0 && !day.isPast && (
                                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isFishingDay ? '#fff' : dayCapColor, marginTop: 1 }} />
                                )}
                              </TouchableOpacity>
                            );
                          });
                        })()}
                      </View>
                      {/* Legend */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' }} /><Text style={{ fontSize: 9, color: '#64748B' }}>Available</Text></View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' }} /><Text style={{ fontSize: 9, color: '#64748B' }}>Fishing Blocked</Text></View>
                        {curDate && (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="arrow-down" size={9} color={cfg.color} /><Text style={{ fontSize: 9, color: '#64748B' }}>Arrival</Text></View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><MaterialCommunityIcons name="fish" size={9} color={cfg.color} /><Text style={{ fontSize: 9, color: '#64748B' }}>Fishing</Text></View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="arrow-up" size={9} color={cfg.color} /><Text style={{ fontSize: 9, color: '#64748B' }}>Departure</Text></View>
                          </>
                        )}
                      </View>
                      {/* ─── Trip schedule badges (Arrival X-1, Fishing X, Departure X+1) ─── */}
                      {curDate ? (
                        <View style={{ marginTop: 10, gap: 6 }}>
                          <View style={[fishS.selectedBadge, { backgroundColor: cfg.bgColor }]}>
                            <Ionicons name="arrow-down" size={14} color={cfg.color} />
                            <Text style={[fishS.selectedBadgeText, { color: cfg.color }]}>{t('fishing_arrival', { date: fishingPrevDay(curDate) })}</Text>
                          </View>
                          <View style={[fishS.selectedBadge, { backgroundColor: cfg.color }]}>
                            <MaterialCommunityIcons name="fish" size={14} color="#fff" />
                            <Text style={[fishS.selectedBadgeText, { color: '#fff' }]}>{t('fishing_day_label', { date: curDate })}</Text>
                          </View>
                          <View style={[fishS.selectedBadge, { backgroundColor: cfg.bgColor }]}>
                            <Ionicons name="arrow-up" size={14} color={cfg.color} />
                            <Text style={[fishS.selectedBadgeText, { color: cfg.color }]}>{t('fishing_departure', { date: fishingNextDay(curDate) })}</Text>
                          </View>
                          <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, padding: 8, marginTop: 2, borderWidth: 1, borderColor: '#BBF7D0' }}>
                            <Text style={{ fontSize: 11, color: '#166534', fontWeight: '600' }}>{t('fishing_2nights_included')}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity style={[fishS.bookButton, { backgroundColor: cfg.color, opacity: curDate && isSelectedDateWhitelisted ? 1 : 0.4 }]} onPress={() => curDate && isSelectedDateWhitelisted && handleAddToCart(activity)} disabled={!curDate || !isSelectedDateWhitelisted} activeOpacity={0.8}>
                      <Ionicons name="boat" size={16} color="#fff" />
                      <Text style={fishS.bookText}>{curDate ? t('book_this_trip', { price: String(totalPrice) }) : t('select_date_first')}</Text>
                    </TouchableOpacity>

                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}





const fishS = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#94A3B8', marginTop: 8 },
  centralImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },


  introBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  introText: { fontSize: 13, color: '#0369A1', flex: 1, lineHeight: 18 },
  optionCard: {
    backgroundColor: '#fff', borderRadius: 18, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#F1F5F9', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  optionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  optionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  optionInfo: { flex: 1 },
  optionName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  optionSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  optionMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  optionRight: { alignItems: 'flex-end', marginLeft: 8 },
  optionPrice: { fontSize: 20, fontWeight: '800', color: '#0D9488' },
  optionPriceSub: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  expandedSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 16, backgroundColor: '#FAFBFC' },
  expandedDesc: { fontSize: 14, color: '#475569', lineHeight: 21, marginBottom: 14 },
  expandedLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  equipGrid: { gap: 6, marginBottom: 16 },
  equipItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  equipText: { fontSize: 13, color: '#475569' },
  // Anglers section
  anglersSection: {
    backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  anglersLabel: { fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 2 },
  anglersNote: { fontSize: 11, color: '#3B82F6', marginBottom: 10 },
  anglersRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  anglersBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
  },
  anglersCount: {
    fontSize: 22, fontWeight: '800', color: '#1E40AF', minWidth: 28, textAlign: 'center',
  },
  anglersExtra: {
    fontSize: 13, fontWeight: '600', color: '#2563EB', marginLeft: 'auto',
  },
  anglersTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#DBEAFE', borderRadius: 10, padding: 10, marginTop: 10,
  },
  anglersTotalLabel: { fontSize: 13, fontWeight: '600', color: '#1E40AF' },
  anglersTotalPrice: { fontSize: 20, fontWeight: '800', color: '#1E40AF' },
  bookButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 14, gap: 8,
  },
  bookButtonDisabled: { backgroundColor: '#CBD5E1' },
  bookText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Inshore note
  inshoreNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  inshoreNoteText: { fontSize: 12, color: '#1E40AF', flex: 1, lineHeight: 18 },
  // Calendar styles for fishing
  calContainer: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 10, marginBottom: 12 },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calNavBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekDay: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  calDaysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: `${100/7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDayText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 8, marginTop: 8, alignSelf: 'flex-start' },
  selectedBadgeText: { fontSize: 12, fontWeight: '700' },
});


function ChillGymCard({ item, onBookChillGym }: {
  item: IslandItem;
  onBookChillGym?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const { t, lang } = useLang();
  const isEs = lang === 'es';
  const gallery = item.galleryImages || [];

  // Resolve translated fields
  const displayName = (isEs && item.name_es) ? item.name_es : item.name;
  const displayDesc = (isEs && item.description_es) ? item.description_es : item.description;
  const displayDetails = (isEs && item.details_es && item.details_es.length > 0) ? item.details_es : item.details;

  return (
    <View style={cardS.card}>
      <TouchableOpacity style={cardS.mainRow} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <Image source={{ uri: item.image }} style={cardS.image} />
        <View style={cardS.info}>
          <Text style={cardS.name} numberOfLines={1}>{displayName}</Text>
          <Text style={cardS.desc} numberOfLines={2}>{displayDesc}</Text>
          <View style={cardS.bottomRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={cardS.price}>{item.priceLabel}</Text>
              <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#059669' }}>{t('kids_free_badge')}</Text>
              </View>
            </View>
            <View style={cardS.expandIcon}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={cardS.expandedSection}>
          {gallery.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cardS.galleryScroll} contentContainerStyle={cardS.galleryRow}>
              {gallery.map((img, idx) => (
                <TouchableOpacity key={idx} onPress={() => setGalleryIdx(idx)} activeOpacity={0.8}>
                  <Image source={{ uri: img }} style={[cardS.galleryThumb, galleryIdx === idx && cardS.galleryThumbActive]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {gallery.length > 0 && (
            <Image source={{ uri: gallery[galleryIdx] || item.image }} style={cardS.galleryMain} resizeMode="cover" />
          )}
          <View style={cardS.detailsGrid}>
            {displayDetails.map((detail, idx) => (
              <View key={idx} style={cardS.detailRow}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={cardS.detailText}>{detail}</Text>
              </View>
            ))}
            <View style={cardS.detailRow}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={[cardS.detailText, { fontWeight: '700', color: '#059669' }]}>{t('kids_are_free')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0FDFA', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#99F6E4' }}>
            <Ionicons name="information-circle" size={16} color="#0D9488" />
            <Text style={{ fontSize: 12, color: '#115E59', flex: 1, lineHeight: 17 }}>{t('chill_gym_info_expanded')}</Text>
          </View>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9488', paddingVertical: 12, borderRadius: 12, gap: 8 }} onPress={() => { if (onBookChillGym) onBookChillGym(); }} activeOpacity={0.8}>
            <Ionicons name="boat" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{t('book_with_boat_chillgym')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!expanded && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDFA', borderRadius: 10, padding: 8, marginHorizontal: 12, marginBottom: 10, borderWidth: 1, borderColor: '#99F6E4' }}>
          <Ionicons name="boat-outline" size={13} color="#0D9488" />
          <Text style={{ fontSize: 11, color: '#115E59', flex: 1 }}>{t('added_when_booking_boat')}</Text>
        </View>
      )}
    </View>
  );
}




// ─── Main Component (icons grid is the selector; sections are unrolled) ───
interface ActivityTabsSectionProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  fishingActivities: Activity[];
  onBookActivity: (activity: Activity) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  scrollTarget?: string;
  onBookInshore?: () => void;
  onOpenCart?: () => void;
  onBookChillGym?: () => void;
  configRefreshKey?: number;
  // New: which part of the page this instance renders
  section?: 'fishing' | 'activities';
  // For activities mode: scroll-to-section support
  scrollRef?: React.RefObject<any>;
  sectionBaseY?: number;
  onBoatPress?: () => void;
  onFishingPress?: () => void;
  // Lets the parent reuse the exact same scroll-to-section logic (quick links / pinned bar)
  onRegisterTabHandler?: (handler: (tab: string) => void) => void;
}

export default function ActivityTabsSection({
  activeTab,
  onTabChange,
  fishingActivities,
  onBookActivity,
  showToast,
  scrollTarget,
  onBookInshore,
  onOpenCart,
  onBookChillGym,
  configRefreshKey,
  section = 'activities',
  scrollRef,
  sectionBaseY = 0,
  onBoatPress,
  onFishingPress,
  onRegisterTabHandler,
}: ActivityTabsSectionProps) {

  const { addItem } = useCart();
  const { t } = useLang();
  const sectionY = useRef<Record<string, number>>({});

  // Re-read config data when configRefreshKey changes (config was reloaded from GitHub)
  const waterItems = useMemo(() => getWaterItemsFromConfig(), [configRefreshKey]);
  const islandItems = useMemo(() => getIslandItemsFromConfig(), [configRefreshKey]);
  const overnightItem = useMemo(() => getOvernightItemFromConfig(), [configRefreshKey]);
  const introTexts = useMemo(() => getIntroTexts(), [configRefreshKey]);


  const handleAddToCart = (name: string, price: number, image: string, date?: string) => {
    addItem({
      id: `activity-${name}-${Date.now()}`,
      type: 'activity',
      name,
      price,
      quantity: 1,
      image_url: image,
      date: date,
    });
    showToast(`${name} added to cart!`, 'success');
  };

  // ─── FISHING-ONLY render (placed between map and boat booking) ───
  if (section === 'fishing') {
    return (
      <View style={styles.container}>
        <FishingTabContent
          fishingActivities={fishingActivities}
          onBook={onBookActivity}
          onBookInshore={onBookInshore}
          onOpenCart={onOpenCart}
        />
      </View>
    );
  }

  // ─── Tab click from icon grid:
  //     boat → scroll up to boat booking
  //     fishing → scroll up to fishing section
  //     others → scroll down to their unrolled section ───
  const handleIconTab = (tab: string) => {
    if (tab === 'boat') {
      if (onBoatPress) onBoatPress();
      return;
    }
    if (tab === 'fishing') {
      if (onFishingPress) onFishingPress();
      return;
    }
    onTabChange(tab);
    const relY = sectionY.current[tab] ?? 0;
    setTimeout(() => {
      scrollRef?.current?.scrollTo({ y: Math.max(0, sectionBaseY + relY - 8), animated: true });
    }, 60);
  };

  // Keep latest handler in a ref and expose a stable wrapper to the parent once.
  const iconTabRef = useRef(handleIconTab);
  iconTabRef.current = handleIconTab;
  useEffect(() => {
    if (onRegisterTabHandler) {
      onRegisterTabHandler((tab: string) => iconTabRef.current(tab));
    }
  }, [onRegisterTabHandler]);



  // ─── ACTIVITIES render — icon grid + ALL sections unrolled ───
  return (
    <View style={styles.container}>
      <ActivityIconGrid onTabSwitch={handleIconTab} activeTab={activeTab} />

      {/* WATER */}
      <View onLayout={(e) => { sectionY.current['water'] = e.nativeEvent.layout.y; }}>
        <View style={styles.tabContent}>
          <View style={styles.tabIntro}>
            <MaterialCommunityIcons name="waves" size={18} color="#0D9488" />
            <Text style={styles.tabIntroText}>{introTexts.water}</Text>
          </View>
          <KayaksCard onAdd={handleAddToCart} configRefreshKey={configRefreshKey} />
          {waterItems.map((item) => (
            <ActivityItemCard key={item.id} item={item} onAdd={handleAddToCart} />
          ))}
        </View>
      </View>

      {/* ISLAND */}
      <View onLayout={(e) => { sectionY.current['island'] = e.nativeEvent.layout.y; }}>
        <View style={styles.tabContent}>
          <View style={[styles.tabIntro, { backgroundColor: '#F0FDF4' }]}>
            <MaterialCommunityIcons name="palm-tree" size={18} color="#16A34A" />
            <Text style={[styles.tabIntroText, { color: '#16A34A' }]}>{introTexts.island}</Text>
          </View>
          {islandItems.map((item) => {
            const isChillGym = item.id === 'chill_gym';
            return isChillGym ? (
              <ChillGymCard key={item.id} item={item} onBookChillGym={onBookChillGym} />
            ) : (
              <ActivityItemCard key={item.id} item={item} onAdd={handleAddToCart} />
            );
          })}
        </View>
      </View>

      {/* OVERNIGHT */}
      <View onLayout={(e) => { sectionY.current['overnight'] = e.nativeEvent.layout.y; }}>
        <View style={styles.tabContent}>
          <View style={[styles.tabIntro, { backgroundColor: '#F5F3FF' }]}>
            <MaterialCommunityIcons name="sleep" size={18} color="#7C3AED" />
            <Text style={[styles.tabIntroText, { color: '#7C3AED' }]}>{tFn('overnight_description')}</Text>
          </View>
          {overnightItem && (
            <OvernightStayCard item={overnightItem} onAdd={handleAddToCart} showToast={showToast} />
          )}
        </View>
      </View>

      {/* FOOD (last) */}
      <View onLayout={(e) => { sectionY.current['food'] = e.nativeEvent.layout.y; }}>
        <IslandFoodSection showToast={showToast} configRefreshKey={configRefreshKey} />
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  tabIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  tabIntroText: {
    fontSize: 13,
    color: '#0D9488',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
});
