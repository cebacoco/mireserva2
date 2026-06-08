import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Beach } from '../lib/types';
import { useCart } from '../lib/cartStore';
import { useLang, getLang, t } from '../lib/i18n';
import { getBeachTags } from '../lib/beachTags';
import { getDayCapacity, checkBoatCapacity, checkFishingCapacity, checkBeachAvailability, isLocoBlockedByFishing, getCapacityColor, getBeachCapacityColor, getBeachDayCapacity, BEACH_MAX_CAPACITY, BOAT_MAX_CAPACITY, isFishingDayBlocked } from '../lib/capacityService';
import { subscribeSyncState, getSyncVersion, getSyncState, getBlockedFishingDates } from '../lib/syncService';
import { getConfig } from '../lib/dataService';
import { isBeachBlackedOut, getBlackoutReason, isDateFullyBlackedOut } from '../lib/blackoutService';




import EnhanceTripOverlay from './EnhanceTripOverlay';



const { width } = Dimensions.get('window');
const GALLERY_WIDTH = width - 72;
const GALLERY_HEIGHT = 180;

// ─── Beach Gallery Photos — ALL from GitHub config, NO hardcoded URLs ───
function getBeachGalleryFromConfig(): { uri: string; caption: string }[] {
  const config = getConfig();
  if (!config || config.beachGallery.length === 0) return [];
  return config.beachGallery.map(photo => ({
    uri: photo.url,
    caption: photo.caption,
  }));
}

// ─── Beach-specific images — ALL from GitHub config, NO hardcoded URLs ───
function getBeachImagesFromConfig(): Record<string, string> {
  const config = getConfig();
  if (!config || config.beaches.length === 0) return {};
  const map: Record<string, string> = {};
  for (const beach of config.beaches) {
    if (beach.image) {
      map[beach.name] = beach.image;
    }
  }
  return map;
}


// Beaches that have Chill & Gym available

const CHILL_GYM_BEACHES = ['Coco Loco', 'Coco Blanco'];




// ─── Overnight Pricing Helper ───
// 1st night $100, 2nd night +$50, 3rd+ nights +$30 each
function calcOvernightTotal(nights: number): number {
  if (nights <= 0) return 0;
  let total = 100; // 1st night
  if (nights >= 2) total += 50; // 2nd night
  if (nights >= 3) total += (nights - 2) * 30; // 3rd+ nights
  return total;
}

function getOvernightBreakdown(nights: number): string {
  if (nights === 1) return '$100 (1st night)';
  if (nights === 2) return '$100 + $50 = $150';
  const extra = (nights - 2) * 30;
  return `$100 + $50 + ${nights - 2} x $30 = $${calcOvernightTotal(nights)}`;
}


function getPrivacyColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}


function getPrivacyLabel(score: number): string {
  if (score >= 80) return t('very_private');
  if (score >= 50) return t('semi_private');
  return t('popular');
}

function getOccupancyLabel(current: number, capacity: number): string {
  const pct = Math.round((current / capacity) * 100);
  if (pct <= 20) return t('empty_beach');
  if (pct <= 50) return t('quiet_beach');
  if (pct <= 75) return t('moderate_beach');
  return t('busy_beach');
}


function getOccupancyColor(current: number, capacity: number): string {
  const pct = Math.round((current / capacity) * 100);
  if (pct <= 20) return '#10B981';
  if (pct <= 50) return '#22C55E';
  if (pct <= 75) return '#F59E0B';
  return '#EF4444';
}

// ─── Calendar Helper ───
const getCalendarMonths = (monthsAhead: number) => {
  const months: { year: number; month: number; label: string; days: { day: number; date: string; isPast: boolean; isToday: boolean }[] }[] = [];
  const today = new Date();
  
  for (let m = 0; m < monthsAhead; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
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

interface BeachBookingCardProps {
  beaches: Beach[];
  onBeachPress: (beach: Beach) => void;
  onSuccess: () => void;
  onOpenCart?: () => void;
  preselectedBeachId?: number | null;
  preselectedInshore?: boolean;
  preselectedChillGym?: boolean;
  // Increment this number to force the card to expand (used by the Boat tab / quick link)
  forceExpandTrigger?: number;
  // Enhance trip callbacks
  onEnhanceFood?: () => void;
  onEnhanceOvernight?: () => void;
  onEnhanceWater?: () => void;
  onEnhanceIsland?: () => void;
  onEnhanceFishing?: () => void;
}

export default function BeachBookingCard({ beaches, onBeachPress, onSuccess, onOpenCart, preselectedBeachId, preselectedInshore, preselectedChillGym, forceExpandTrigger, onEnhanceFood, onEnhanceOvernight, onEnhanceWater, onEnhanceIsland, onEnhanceFishing }: BeachBookingCardProps) {

  // ─── ALL images from GitHub config — NO hardcoded URLs ───
  const BEACH_PHOTOS = useMemo(() => getBeachGalleryFromConfig(), []);
  const BEACH_IMAGES = useMemo(() => getBeachImagesFromConfig(), []);

  const { addItem } = useCart();

  const [expanded, setExpanded] = useState(false);
  const [selectedBeachId, setSelectedBeachId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [kidsUnder8, setKidsUnder8] = useState(0);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [activeGalleryIdx, setActiveGalleryIdx] = useState(0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(0);
  const [validationError, setValidationError] = useState('');

  // Add-on states
  const [addonInternet, setAddonInternet] = useState(false);
  const [internetPhones, setInternetPhones] = useState(1);
  const [addonCharging, setAddonCharging] = useState(false);
  const [chargingPhones, setChargingPhones] = useState(1);
  const [addonShower, setAddonShower] = useState(false);
  const [addonKitchen, setAddonKitchen] = useState(false);
  const [addonChillGym, setAddonChillGym] = useState(false);
  const [addonOvernight, setAddonOvernight] = useState(false);
  const [overnightNights, setOvernightNights] = useState(1);
  const [addonInshoreFishing, setAddonInshoreFishing] = useState(false);

  // ─── SYNC STATE: Subscribe to sync changes for calendar updates ───
  const [syncVer, setSyncVer] = useState(getSyncVersion());
  useEffect(() => {
    const unsub = subscribeSyncState(() => {
      setSyncVer(getSyncVersion());
    });
    return unsub;
  }, []);


  // Pre-compute blocked fishing dates map for calendar visualization
  // Uses getBlockedFishingDates() from syncService — GitHub data ONLY, no bundled data
  const blockedFishingMap = getBlockedFishingDates();



  const calendarMonths = getCalendarMonths(3);
  const galleryRef = useRef<ScrollView>(null);

  const totalPassengers = adults + kidsUnder8;


  // React to preselected beach from map
  useEffect(() => {
    if (preselectedBeachId != null) {
      setSelectedBeachId(preselectedBeachId);
      setExpanded(true);
    }
  }, [preselectedBeachId]);

  // React to preselected inshore fishing (from fishing tab)
  useEffect(() => {
    if (preselectedInshore) {
      setAddonInshoreFishing(true);
      setExpanded(true);
    }
  }, [preselectedInshore]);

  // React to preselected chill & gym (from island activities tab)
  useEffect(() => {
    if (preselectedChillGym) {
      // Auto-select a Chill & Gym compatible beach FIRST (Coco Loco by default)
      const compatibleBeach = beaches.find(b => b.name === 'Coco Loco') || beaches.find(b => CHILL_GYM_BEACHES.includes(b.name));
      if (compatibleBeach) {
        setSelectedBeachId(compatibleBeach.id);
      }
      setAddonChillGym(true);
      setExpanded(true);
    }
  }, [preselectedChillGym]);

  // React to force-expand requests (Boat tab / quick link). Skip the initial 0 value.
  useEffect(() => {
    if (forceExpandTrigger && forceExpandTrigger > 0) {
      setExpanded(true);
    }
  }, [forceExpandTrigger]);



  // Clear validation error when user makes selections
  useEffect(() => {
    if (validationError && (selectedBeachId || selectedDate)) {
      setValidationError('');
    }
  }, [selectedBeachId, selectedDate]);

  // Reset chill&gym if beach changes to one that doesn't support it
  // BUT don't reset if preselectedChillGym is active (to avoid race condition)
  const selectedBeach = beaches.find(b => b.id === selectedBeachId) || null;
  const chillGymAvailable = selectedBeach ? CHILL_GYM_BEACHES.includes(selectedBeach.name) : false;

  useEffect(() => {
    if (!chillGymAvailable && !preselectedChillGym) {
      setAddonChillGym(false);
    }
  }, [chillGymAvailable, preselectedChillGym]);


  const selectBeach = (id: number) => {
    setSelectedBeachId(prev => prev === id ? null : id);
    setValidationError('');
  };

  // ─── Price Calculation ───
  const boatFare = adults * 50; // $50 per person, kids under 8 free

  // Add-on costs (before overnight cap)
  const internetCost = addonInternet ? 5 * internetPhones : 0;
  const chargingCost = addonCharging ? 5 * chargingPhones : 0;
  const showerCost = addonShower ? 10 * totalPassengers : 0;
  const kitchenCost = addonKitchen ? 50 : 0;
  const chillGymCost = addonChillGym ? 10 * adults : 0; // Kids are FREE for Chill & Gym

  const inshoreFishingCost = addonInshoreFishing ? 300 : 0;

  // If overnight is selected, add-ons (kitchen, shower, internet, charging, chill&gym) are capped at $100/night
  let overnightCost = 0;
  let addonsBeforeCap = internetCost + chargingCost + showerCost + kitchenCost + chillGymCost;
  let addonTotal = 0;

  if (addonOvernight) {
    // Overnight: 1st night $100, 2nd night +$50, 3rd+ nights +$30 each
    overnightCost = calcOvernightTotal(overnightNights);
    // All add-ons are included in the overnight price
    addonTotal = overnightCost + inshoreFishingCost;

  } else {
    addonTotal = addonsBeforeCap + inshoreFishingCost;
  }

  const grandTotal = boatFare + addonTotal;


  const handleGalleryScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (GALLERY_WIDTH + 10));
    setActiveGalleryIdx(index);
  };

  const handleBook = () => {
    try {
      // Validate beach selection
      if (!selectedBeachId) {
        setValidationError(t('select_beach_error'));
        return;
      }
      // Validate date selection
      if (!selectedDate) {
        setValidationError(t('select_date_error'));
        return;
      }
      // ─── BEACH AVAILABILITY CHECK (per-beach capacity + overnight exclusivity) ───
      const beachName = selectedBeach?.name || 'Beach';

      // ─── BLACKOUT CHECK (operator-defined closures from config) ───
      if (isBeachBlackedOut(selectedDate, beachName)) {
        setValidationError(getBlackoutReason(selectedDate, beachName));
        return;
      }


      const beachAvail = checkBeachAvailability(
        selectedDate,
        beachName,
        totalPassengers,
        addonOvernight,
        addonOvernight ? overnightNights : undefined
      );
      if (!beachAvail.canBook) {
        setValidationError(beachAvail.reason);
        return;
      }

      // Check fishing capacity if inshore fishing is selected
      // Inshore fishing also blocks Loco for 2 days
      if (addonInshoreFishing) {
        const fishCheck = checkFishingCapacity(selectedDate, totalPassengers, 'inshore');
        if (!fishCheck.canBook) {
          setValidationError(fishCheck.message);
          return;
        }
      }


      setValidationError('');

      const addons: string[] = [];

      if (addonOvernight) addons.push(`${t('overnight_stay')} x${overnightNights}`);
      if (addonInternet) addons.push(`${t('internet')} x${internetPhones}`);
      if (addonCharging) addons.push(`${t('charging_phone')} x${chargingPhones}`);
      if (addonShower) addons.push(t('shower'));
      if (addonKitchen) addons.push(t('kitchen'));
      if (addonChillGym) addons.push(t('chill_gym'));
      if (addonInshoreFishing) addons.push(t('inshore_fishing'));
      const addonStr = addons.length > 0 ? ` + ${addons.join(', ')}` : '';

      const cartItem = {
        id: `boat-${selectedBeachId}-${selectedDate}-${Date.now()}`,
        type: 'activity' as const,
        name: `Boat to ${beachName}${addonStr}`,
        price: grandTotal,
        quantity: 1,
        date: selectedDate,
        participants: totalPassengers,
        image_url: selectedBeach?.image_url,
      };

      addItem(cartItem);

      // Show success state
      setBookingSuccess(true);
      onSuccess();

      // Open cart sidebar after a brief moment so user sees the success banner first
      setTimeout(() => {
        if (onOpenCart) onOpenCart();
      }, 400);

      // Reset form after delay
      setTimeout(() => {
        setBookingSuccess(false);
        setExpanded(false);
        setSelectedBeachId(null);
        setSelectedDate('');
        setAddonInternet(false);
        setAddonCharging(false);
        setAddonShower(false);
        setAddonKitchen(false);
        setAddonChillGym(false);
        setAddonOvernight(false);
        setOvernightNights(1);
        setAddonInshoreFishing(false);
        setAdults(2);
        setKidsUnder8(0);
        setValidationError('');
      }, 2500);
    } catch (err) {
      console.error('handleBook error:', err);
      setValidationError(t('something_wrong'));
    }
  };






  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.bookButton}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.bookButtonLeft}>
          <View style={styles.bookIconCircle}>
            <Ionicons name="boat" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookButtonTitle}>{t('book_the_boat')}</Text>
            <Text style={styles.bookButtonSub}>
              {t('price_per_person')}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color="#0D9488"
        />
      </TouchableOpacity>

      {/* Expanded booking form */}
      {expanded && (
        <View style={styles.expandedContent}>


          {/* ─── Beach Gallery ─── */}
          <Text style={styles.label}>{t('island_gallery')}</Text>
          <View style={styles.galleryContainer}>
            <ScrollView
              ref={galleryRef}
              horizontal
              pagingEnabled={false}
              snapToInterval={GALLERY_WIDTH + 10}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScroll={handleGalleryScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.galleryScroll}
            >
              {BEACH_PHOTOS.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.galleryCard}
                  onPress={() => { setFullscreenIdx(index); setFullscreenVisible(true); }}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: photo.uri }} style={styles.galleryImage} resizeMode="cover" />
                  <View style={styles.galleryOverlay}>
                    <View style={styles.galleryInfo}>
                      <Text style={styles.galleryCaption}>{photo.caption}</Text>
                    </View>

                    <View style={styles.galleryExpandBtn}>
                      <Ionicons name="expand" size={14} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.galleryDots}>
              {BEACH_PHOTOS.map((_, i) => (
                <View key={i} style={[styles.galleryDot, activeGalleryIdx === i && styles.galleryDotActive]} />
              ))}
            </View>
          </View>

          {/* ─── Beach Selection (radio, with images) ─── */}
          <Text style={styles.label}>{t('select_beach')}</Text>
          {beaches.map((beach) => {
            const isSelected = selectedBeachId === beach.id;
            const beachImage = BEACH_IMAGES[beach.name];
            const tags = getBeachTags(beach.name);

            return (
              <TouchableOpacity
                key={beach.id}
                style={[styles.beachRow, isSelected && styles.beachRowActive]}
                onPress={() => selectBeach(beach.id)}
                activeOpacity={0.7}
              >
                {/* Radio button */}
                <View style={styles.beachRadio}>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </View>

                {/* Beach image */}
                {beachImage && (
                  <Image
                    source={{ uri: beachImage }}
                    style={styles.beachThumb}
                    resizeMode="cover"
                  />
                )}

                <View style={styles.beachInfo}>
                  <Text style={[styles.beachName, isSelected && { color: '#0D9488' }]}>{beach.name}</Text>
                  
                  {/* Privacy & Occupancy */}
                  <View style={styles.beachMetaRow}>
                    <View style={[styles.metaBadge, { backgroundColor: getPrivacyColor(beach.privacy_score) + '20' }]}>
                      <View style={[styles.metaDot, { backgroundColor: getPrivacyColor(beach.privacy_score) }]} />
                      <Text style={[styles.metaText, { color: getPrivacyColor(beach.privacy_score) }]}>
                        {getPrivacyLabel(beach.privacy_score)}
                      </Text>
                    </View>
                    <View style={[styles.metaBadge, { backgroundColor: getOccupancyColor(beach.current_occupancy, beach.capacity) + '20' }]}>
                      <Text style={[styles.metaText, { color: getOccupancyColor(beach.current_occupancy, beach.capacity) }]}>
                        {getOccupancyLabel(beach.current_occupancy, beach.capacity)}
                      </Text>
                    </View>
                  </View>

                  {/* Beach Tags */}
                  <View style={styles.featureRow}>
                    {tags.map((tag, idx) => (
                      <View key={idx} style={[styles.featureChip, { backgroundColor: tag.bgColor }]}>
                        <Ionicons name={tag.icon as any} size={10} color={tag.color} />
                        <Text style={[styles.featureText, { color: tag.color }]}>{t(tag.key)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}



          {/* Selected summary */}
          {selectedBeach && (
            <View style={styles.selectedSummary}>
              <Ionicons name="checkmark-circle" size={16} color="#0D9488" />
              <Text style={styles.selectedSummaryText}>
                {selectedBeach.name}
              </Text>
            </View>
          )}

          {/* ─── Calendar ─── */}
          <Text style={styles.label}>{t('when')}</Text>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarNav}>
              <TouchableOpacity
                style={[styles.calNavBtn, calendarMonth === 0 && { opacity: 0.3 }]}
                onPress={() => setCalendarMonth(Math.max(0, calendarMonth - 1))}
                disabled={calendarMonth === 0}
              >
                <Ionicons name="chevron-back" size={18} color="#0D9488" />
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>{calendarMonths[calendarMonth]?.label}</Text>
              <TouchableOpacity
                style={[styles.calNavBtn, calendarMonth >= calendarMonths.length - 1 && { opacity: 0.3 }]}
                onPress={() => setCalendarMonth(Math.min(calendarMonths.length - 1, calendarMonth + 1))}
                disabled={calendarMonth >= calendarMonths.length - 1}
              >
                <Ionicons name="chevron-forward" size={18} color="#0D9488" />
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {[t('cal_su'), t('cal_mo'), t('cal_tu'), t('cal_we'), t('cal_th'), t('cal_fr'), t('cal_sa')].map((d, i) => (
                <Text key={i} style={styles.calWeekDay}>{d}</Text>
              ))}
            </View>

            <View style={styles.calDaysGrid}>
              {calendarMonths[calendarMonth]?.days.map((day, idx) => {
                if (day.day === 0) {
                  return <View key={`empty-${idx}`} style={styles.calDayCell} />;
                }
                const isDateSelected = selectedDate === day.date;
                const isDisabled = day.isPast;
                // Get capacity for this date
                const dayCap = !isDisabled ? getDayCapacity(day.date) : null;
                const dayCapColor = !isDisabled ? getCapacityColor(day.date) : undefined;
                const dayIsFull = dayCap ? dayCap.isFull : false;
                
                // Check fishing blocking (Loco locked) and overnight info
                const fishingBlockReason = !isDisabled ? blockedFishingMap[day.date] : undefined;
                const hasFishingBlock = !!fishingBlockReason;
                const hasOvernight = dayCap ? dayCap.overnightBooked : false;
                const locoLocked = !isDisabled ? isLocoBlockedByFishing(day.date) : false;
                
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.calDayCell,
                      isDateSelected && styles.calDayCellSelected,
                      day.isToday && !isDateSelected && styles.calDayCellToday,
                      // Show Loco-locked days with subtle red tint (not disabled — user can still book other beaches)
                      locoLocked && !isDateSelected && !day.isPast && { backgroundColor: '#FEF2F2', borderRadius: 10 },
                    ]}
                    onPress={() => !isDisabled && setSelectedDate(day.date)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.calDayText,
                      isDateSelected && styles.calDayTextSelected,
                      isDisabled && styles.calDayTextDisabled,
                      day.isToday && !isDateSelected && styles.calDayTextToday,
                      dayIsFull && !isDateSelected && { color: '#EF4444' },
                      locoLocked && !isDateSelected && !day.isPast && { color: '#DC2626', fontWeight: '700' },
                    ]}>
                      {day.day}
                    </Text>
                    {/* Fishing lock indicator — red dot */}
                    {locoLocked && !isDisabled && !isDateSelected && (
                      <View style={{
                        width: 5, height: 5, borderRadius: 2.5,
                        backgroundColor: '#DC2626',
                        marginTop: 1,
                      }} />
                    )}
                    {/* Overnight indicator — purple dot */}
                    {!locoLocked && hasOvernight && !isDisabled && !isDateSelected && (
                      <View style={{
                        width: 5, height: 5, borderRadius: 2.5,
                        backgroundColor: '#7C3AED',
                        marginTop: 1,
                      }} />
                    )}
                    {/* Capacity dot under the day number */}
                    {!locoLocked && !hasOvernight && dayCap && dayCap.bookedPersons > 0 && !isDisabled && (
                      <View style={{
                        width: 5, height: 5, borderRadius: 2.5,
                        backgroundColor: isDateSelected ? '#fff' : dayCapColor,
                        marginTop: 1,
                      }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>




            {/* Capacity legend */}
            {/* Capacity legend */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' }} />
                <Text style={{ fontSize: 9, color: '#64748B' }}>Available</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#F59E0B' }} />
                <Text style={{ fontSize: 9, color: '#64748B' }}>Filling up</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#EF4444' }} />
                <Text style={{ fontSize: 9, color: '#64748B' }}>Full</Text>
              </View>
              <Text style={{ fontSize: 9, color: '#94A3B8', marginLeft: 'auto' }}>Max {BEACH_MAX_CAPACITY}/beach</Text>
            </View>

            {selectedDate ? (
              <View style={styles.selectedDateBadge}>
                <Ionicons name="calendar" size={14} color="#0D9488" />
                <Text style={styles.selectedDateText}>{selectedDate}</Text>
              </View>
            ) : null}

            {/* ─── Per-Beach Capacity Info Banner (shown when date + beach selected) ─── */}
            {selectedDate && selectedBeach ? (() => {
              const beachName = selectedBeach.name;

              // Blackout closure takes priority over everything else
              if (isBeachBlackedOut(selectedDate, beachName)) {
                return (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginTop: 8,
                    borderWidth: 1, borderColor: '#FECACA',
                  }}>
                    <Ionicons name="lock-closed" size={18} color="#DC2626" />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#DC2626', flex: 1 }}>
                      {getBlackoutReason(selectedDate, beachName)}
                    </Text>
                  </View>
                );
              }

              const beachAvail = checkBeachAvailability(selectedDate, beachName, totalPassengers);
              const beachCap = getBeachDayCapacity(selectedDate, beachName);
              const beachColor = getBeachCapacityColor(selectedDate, beachName);
              const locoBlocked = beachName.toLowerCase().includes('loco') && isLocoBlockedByFishing(selectedDate);
              

              return (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: locoBlocked ? '#FEF2F2' : beachCap.isFull ? '#FEF2F2' : beachAvail.canBook ? '#F0FDF4' : '#FFFBEB',
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: locoBlocked ? '#FECACA' : beachCap.isFull ? '#FECACA' : beachAvail.canBook ? '#BBF7D0' : '#FEF3C7',
                }}>
                  <Ionicons
                    name={locoBlocked ? 'lock-closed' : beachCap.isFull ? 'close-circle' : beachAvail.canBook ? 'checkmark-circle' : 'warning'}
                    size={18}
                    color={locoBlocked ? '#DC2626' : beachCap.isFull ? '#DC2626' : beachAvail.canBook ? '#16A34A' : '#D97706'}
                  />
                  <View style={{ flex: 1 }}>
                    {locoBlocked ? (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#DC2626' }}>
                        Coco Loco is reserved for a fishing trip (overnight privacy). Choose another beach or day.
                      </Text>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: beachColor }}>
                            {beachCap.bookedPersons}/{BEACH_MAX_CAPACITY}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#64748B' }}>at {beachName}</Text>
                          <View style={{ flex: 1, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                            <View style={{ width: `${beachCap.capacityPercent}%`, height: '100%', backgroundColor: beachColor, borderRadius: 2 }} />
                          </View>
                        </View>
                        <Text style={{ fontSize: 11, color: beachCap.isFull ? '#DC2626' : beachAvail.canBook ? '#16A34A' : '#92400E', marginTop: 3, fontWeight: '600' }}>
                          {beachAvail.reason}
                        </Text>
                      </>
                    )}
                    {(() => {
                      const cap = getDayCapacity(selectedDate);
                      return cap.fishingGroupsBooked > 0 ? (
                        <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                          Fishing group booked — Loco Beach reserved for privacy
                        </Text>
                      ) : null;
                    })()}
                  </View>
                </View>
              );
            })() : selectedDate ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginTop: 8,
                borderWidth: 1, borderColor: '#FEF3C7',
              }}>
                <Ionicons name="information-circle" size={16} color="#D97706" />
                <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600' }}>Select a beach to see availability for this date</Text>
              </View>
            ) : null}

          </View>


          {/* ─── Passengers (Adults + Kids) ─── */}
          <Text style={styles.label}>{t('passengers')}</Text>
          <View style={styles.passengersContainer}>
            {/* Adults */}
            <View style={styles.passengerTypeRow}>
              <View style={styles.passengerTypeInfo}>
                <Text style={styles.passengerTypeLabel}>{t('adults')}</Text>
                <Text style={styles.passengerTypePrice}>{t('price_per_adult')}</Text>
              </View>
              <View style={styles.participantRow}>
                <TouchableOpacity
                  style={styles.participantBtn}
                  onPress={() => setAdults(Math.max(1, adults - 1))}
                >
                  <Ionicons name="remove" size={18} color="#0D9488" />
                </TouchableOpacity>
                <Text style={styles.participantNumber}>{adults}</Text>
                <TouchableOpacity
                  style={styles.participantBtn}
                  onPress={() => setAdults(Math.min(20, adults + 1))}
                >
                  <Ionicons name="add" size={18} color="#0D9488" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Kids under 8 */}
            <View style={styles.passengerTypeRow}>
              <View style={styles.passengerTypeInfo}>
                <Text style={styles.passengerTypeLabel}>{t('kids_under_8')}</Text>
                <View style={styles.freeKidsBadge}>
                  <Text style={styles.freeKidsText}>{t('free')}</Text>
                </View>
              </View>
              <View style={styles.participantRow}>
                <TouchableOpacity
                  style={styles.participantBtn}
                  onPress={() => setKidsUnder8(Math.max(0, kidsUnder8 - 1))}
                >
                  <Ionicons name="remove" size={18} color="#0D9488" />
                </TouchableOpacity>
                <Text style={styles.participantNumber}>{kidsUnder8}</Text>
                <TouchableOpacity
                  style={styles.participantBtn}
                  onPress={() => setKidsUnder8(Math.min(10, kidsUnder8 + 1))}
                >
                  <Ionicons name="add" size={18} color="#0D9488" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Boat fare summary */}
            <View style={styles.boatFareSummary}>
              <Ionicons name="boat" size={14} color="#0D9488" />
              <Text style={styles.boatFareText}>
                {t('boat_fare', { adults: String(adults), total: String(boatFare) })}{kidsUnder8 > 0 ? ` ${t('kids_free', { kids: String(kidsUnder8) })}` : ''}
              </Text>
            </View>
          </View>

          {/* ─── Add-ons ─── */}
          <Text style={styles.label}>{t('addons')}</Text>
          <View style={addonStyles.container}>
            {/* Overnight Stay */}
            <TouchableOpacity
              style={[addonStyles.row, addonOvernight && addonStyles.rowActiveOvernight]}
              onPress={() => setAddonOvernight(!addonOvernight)}
              activeOpacity={0.7}
            >
              <View style={addonStyles.checkboxOuter}>
                {addonOvernight ? (
                  <View style={[addonStyles.checkboxFilled, { backgroundColor: '#7C3AED' }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                ) : (
                  <View style={addonStyles.checkboxEmpty} />
                )}
              </View>
              <View style={[addonStyles.iconBg, { backgroundColor: '#F5F3FF' }]}>
                <MaterialCommunityIcons name="sleep" size={16} color="#7C3AED" />
              </View>
               <View style={addonStyles.info}>
                <Text style={addonStyles.name}>{t('overnight_stay')}</Text>
                <Text style={addonStyles.detail}>{t('overnight_detail')}</Text>
                <Text style={[addonStyles.detail, { color: '#7C3AED', fontWeight: '600', marginTop: 2 }]}>{t('overnight_discount_detail')}</Text>
              </View>
              <Text style={[addonStyles.price, { color: '#7C3AED' }]}>$100</Text>
            </TouchableOpacity>

            {/* Overnight nights selector + info */}
            {addonOvernight && (
              <View style={addonStyles.overnightExpanded}>
                <View style={addonStyles.nightsRow}>
                  <Text style={addonStyles.nightsLabel}>{t('number_of_nights_label')}</Text>
                  <View style={addonStyles.nightsControls}>
                    <TouchableOpacity style={addonStyles.nightsBtn} onPress={() => setOvernightNights(Math.max(1, overnightNights - 1))}>
                      <Ionicons name="remove" size={14} color="#7C3AED" />
                    </TouchableOpacity>
                    <Text style={addonStyles.nightsText}>{overnightNights}</Text>
                    <TouchableOpacity style={addonStyles.nightsBtn} onPress={() => setOvernightNights(Math.min(14, overnightNights + 1))}>
                      <Ionicons name="add" size={14} color="#7C3AED" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={addonStyles.overnightIncluded}>
                  <Text style={addonStyles.overnightIncludedTitle}>{t('overnight_included_title')}</Text>
                  {[t('kitchen'), t('shower'), t('internet'), t('charging_phone'), t('chill_gym')].map((item, i) => (
                    <View key={i} style={addonStyles.overnightIncludedRow}>
                      <Ionicons name="checkmark-circle" size={12} color="#7C3AED" />
                      <Text style={addonStyles.overnightIncludedText}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={addonStyles.returnBoatInfo}>
                  <Ionicons name="information-circle" size={16} color="#D97706" />
                  <Text style={addonStyles.returnBoatText}>
                    {t('return_boat_note')}
                  </Text>
                </View>

                <View style={addonStyles.overnightTotal}>
                  <View>
                    <Text style={addonStyles.overnightTotalLabel}>{t('overnight_total')}</Text>
                    <Text style={{ fontSize: 9, color: '#7C3AED', marginTop: 2 }}>{getOvernightBreakdown(overnightNights)}</Text>
                  </View>
                  <Text style={addonStyles.overnightTotalPrice}>${calcOvernightTotal(overnightNights)}</Text>
                </View>

              </View>
            )}

            {/* Chill & Gym (only for Loco and Blanco) */}
            {chillGymAvailable && !addonOvernight && (
              <TouchableOpacity
                style={[addonStyles.row, addonChillGym && addonStyles.rowActive]}
                onPress={() => setAddonChillGym(!addonChillGym)}
                activeOpacity={0.7}
              >
                <View style={addonStyles.checkboxOuter}>
                  {addonChillGym ? (
                    <View style={addonStyles.checkboxFilled}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                  ) : (
                    <View style={addonStyles.checkboxEmpty} />
                  )}
                </View>
                <View style={[addonStyles.iconBg, { backgroundColor: '#F0FDFA' }]}>
                  <Ionicons name="fitness" size={16} color="#0D9488" />
                </View>
                <View style={addonStyles.info}>
                  <Text style={addonStyles.name}>{t('chill_gym')}</Text>
                  <Text style={addonStyles.detail}>{t('chill_gym_detail', { pax: String(adults) })}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#059669' }}>{t('kids_free_badge')}</Text>
                    </View>
                    {kidsUnder8 > 0 && (
                      <Text style={{ fontSize: 9, color: '#059669', fontWeight: '600' }}>({t('kids_free', { kids: String(kidsUnder8) })})</Text>
                    )}
                  </View>
                </View>
                <Text style={addonStyles.price}>{addonChillGym ? `$${10 * adults}` : '$10'}</Text>

              </TouchableOpacity>
            )}

            {/* Charging Phone - hidden when overnight selected (included) */}
            {!addonOvernight && (
              <TouchableOpacity
                style={[addonStyles.row, addonCharging && addonStyles.rowActive]}
                onPress={() => setAddonCharging(!addonCharging)}
                activeOpacity={0.7}
              >
                <View style={addonStyles.checkboxOuter}>
                  {addonCharging ? (
                    <View style={addonStyles.checkboxFilled}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                  ) : (
                    <View style={addonStyles.checkboxEmpty} />
                  )}
                </View>
                <View style={[addonStyles.iconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="battery-charging" size={16} color="#D97706" />
                </View>
                <View style={addonStyles.info}>
                  <Text style={addonStyles.name}>{t('charging_phone')}</Text>
                  <Text style={addonStyles.detail}>{t('charging_detail')}</Text>
                </View>
                {addonCharging && (
                  <View style={addonStyles.qtyRow}>
                    <TouchableOpacity style={addonStyles.qtyBtn} onPress={() => setChargingPhones(Math.max(1, chargingPhones - 1))}>
                      <Ionicons name="remove" size={14} color="#0D9488" />
                    </TouchableOpacity>
                    <Text style={addonStyles.qtyText}>{chargingPhones}</Text>
                    <TouchableOpacity style={addonStyles.qtyBtn} onPress={() => setChargingPhones(Math.min(10, chargingPhones + 1))}>
                      <Ionicons name="add" size={14} color="#0D9488" />
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={addonStyles.price}>{addonCharging ? `$${5 * chargingPhones}` : '$5'}</Text>
              </TouchableOpacity>
            )}

            {/* Shower - hidden when overnight selected (included) */}
            {!addonOvernight && (
              <TouchableOpacity
                style={[addonStyles.row, addonShower && addonStyles.rowActive]}
                onPress={() => setAddonShower(!addonShower)}
                activeOpacity={0.7}
              >
                <View style={addonStyles.checkboxOuter}>
                  {addonShower ? (
                    <View style={addonStyles.checkboxFilled}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                  ) : (
                    <View style={addonStyles.checkboxEmpty} />
                  )}
                </View>
                <View style={[addonStyles.iconBg, { backgroundColor: '#F0FDFA' }]}>
                  <Ionicons name="water" size={16} color="#0D9488" />
                </View>
                <View style={addonStyles.info}>
                  <Text style={addonStyles.name}>{t('shower_addon')}</Text>
                  <Text style={addonStyles.detail}>{t('shower_detail', { pax: String(totalPassengers) })}</Text>
                </View>
                <Text style={addonStyles.price}>{addonShower ? `$${10 * totalPassengers}` : '$10'}</Text>
              </TouchableOpacity>
            )}

            {/* Kitchen - per group - hidden when overnight selected (included) */}
            {!addonOvernight && (
              <TouchableOpacity
                style={[addonStyles.row, addonKitchen && addonStyles.rowActive]}
                onPress={() => setAddonKitchen(!addonKitchen)}
                activeOpacity={0.7}
              >
                <View style={addonStyles.checkboxOuter}>
                  {addonKitchen ? (
                    <View style={addonStyles.checkboxFilled}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                  ) : (
                    <View style={addonStyles.checkboxEmpty} />
                  )}
                </View>
                <View style={[addonStyles.iconBg, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="restaurant" size={16} color="#EA580C" />
                </View>
                <View style={addonStyles.info}>
                  <Text style={addonStyles.name}>{t('kitchen')}</Text>
                  <Text style={addonStyles.detail}>{t('kitchen_detail')}</Text>
                </View>
                <Text style={addonStyles.price}>$50</Text>
              </TouchableOpacity>
            )}

            {/* Inshore Fishing add-on */}
            <TouchableOpacity
              style={[addonStyles.row, addonInshoreFishing && { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]}
              onPress={() => setAddonInshoreFishing(!addonInshoreFishing)}
              activeOpacity={0.7}
            >
              <View style={addonStyles.checkboxOuter}>
                {addonInshoreFishing ? (
                  <View style={[addonStyles.checkboxFilled, { backgroundColor: '#2563EB' }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                ) : (
                  <View style={addonStyles.checkboxEmpty} />
                )}
              </View>
              <View style={[addonStyles.iconBg, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="fish" size={16} color="#2563EB" />
              </View>
              <View style={addonStyles.info}>
                <Text style={addonStyles.name}>{t('inshore_fishing')}</Text>
                <Text style={addonStyles.detail}>{t('inshore_fishing_detail')}</Text>
              </View>
              <Text style={[addonStyles.price, { color: '#2563EB' }]}>$300</Text>
            </TouchableOpacity>

            {/* Add-on total */}
            {addonTotal > 0 && (
              <View style={addonStyles.totalRow}>
                <Text style={addonStyles.totalLabel}>{t('addons_total')}</Text>
                <Text style={addonStyles.totalPrice}>${addonTotal}</Text>
              </View>
            )}
          </View>

          {/* ─── Price Summary ─── */}
          <View style={styles.priceSummaryContainer}>
            <Text style={styles.priceSummaryTitle}>{t('price_summary')}</Text>
            <View style={styles.priceSummaryRow}>
              <Text style={styles.priceSummaryLabel}>{t('boat_fare_label', { adults: String(adults) })}</Text>
              <Text style={styles.priceSummaryValue}>${boatFare}</Text>
            </View>
            {kidsUnder8 > 0 && (
              <View style={styles.priceSummaryRow}>
                <Text style={styles.priceSummaryLabel}>{t('kids_under_8_count', { kids: String(kidsUnder8) })}</Text>
                <Text style={[styles.priceSummaryValue, { color: '#059669' }]}>{t('free')}</Text>
              </View>
            )}
            {addonTotal > 0 && (
              <View style={styles.priceSummaryRow}>
                <Text style={styles.priceSummaryLabel}>
                  {addonOvernight ? t('overnight_label', { nights: String(overnightNights) }) : t('addons')}
                </Text>
                <Text style={styles.priceSummaryValue}>${addonTotal}</Text>
              </View>
            )}
            <View style={styles.priceSummaryDivider} />
            <View style={styles.priceSummaryRow}>
              <Text style={styles.priceSummaryGrandLabel}>{t('total')}</Text>
              <Text style={styles.priceSummaryGrandValue}>${grandTotal}</Text>
            </View>
          </View>

          {/* ─── Validation Error ─── */}
          {validationError ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#FECACA' }}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626', flex: 1 }}>{validationError}</Text>
            </View>
          ) : null}

          {/* ─── Book this Trip button ─── */}
          <View style={{ marginTop: validationError ? 8 : 12 }}>
            {bookingSuccess ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                <Text style={styles.successText}>{t('booked_opening_cart')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (!selectedBeachId || !selectedDate) && { opacity: 0.7 },
                ]}
                onPress={handleBook}
                activeOpacity={0.8}
              >
                <Ionicons name="boat" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>{t('book_trip', { price: String(grandTotal) })}</Text>
              </TouchableOpacity>
            )}
          </View>



        </View>
      )}


      {/* ─── Fullscreen Gallery Modal ─── */}
      <Modal visible={fullscreenVisible} animationType="fade" transparent>
        <View style={styles.fsOverlay}>
          <TouchableOpacity style={styles.fsClose} onPress={() => setFullscreenVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: BEACH_PHOTOS[fullscreenIdx]?.uri }}
            style={styles.fsImage}
            resizeMode="contain"
          />
          <View style={styles.fsInfo}>
            <Text style={styles.fsCaption}>{BEACH_PHOTOS[fullscreenIdx]?.caption}</Text>
          </View>

          <View style={styles.fsNav}>
            <TouchableOpacity
              style={[styles.fsNavBtn, fullscreenIdx === 0 && { opacity: 0.3 }]}
              onPress={() => setFullscreenIdx(Math.max(0, fullscreenIdx - 1))}
              disabled={fullscreenIdx === 0}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fsCounter}>{fullscreenIdx + 1} / {BEACH_PHOTOS.length}</Text>
            <TouchableOpacity
              style={[styles.fsNavBtn, fullscreenIdx === BEACH_PHOTOS.length - 1 && { opacity: 0.3 }]}
              onPress={() => setFullscreenIdx(Math.min(BEACH_PHOTOS.length - 1, fullscreenIdx + 1))}
              disabled={fullscreenIdx === BEACH_PHOTOS.length - 1}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const contactStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  toggleBtnActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  toggleTextActive: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  whatsappIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  ourContactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  ourContactText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 17,
  },
  ourContactHighlight: {
    fontWeight: '700',
    color: '#0D9488',
  },
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  bookButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bookIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  bookButtonSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  forewordBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  forewordText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
    marginBottom: 10,
  },

  // Gallery
  galleryContainer: { marginBottom: 4 },
  galleryScroll: { paddingRight: 10 },
  galleryCard: { width: GALLERY_WIDTH, height: GALLERY_HEIGHT, borderRadius: 16, overflow: 'hidden', marginRight: 10 },
  galleryImage: { width: '100%', height: '100%' },
  galleryOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    padding: 10, paddingTop: 30,
  },
  galleryInfo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: 8, marginRight: 6 },
  galleryCaption: { fontSize: 12, fontWeight: '700', color: '#fff' },
  galleryLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  galleryLocation: { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  galleryExpandBtn: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  galleryDots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
  galleryDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#CBD5E1' },
  galleryDotActive: { width: 16, backgroundColor: '#0D9488', borderRadius: 2.5 },

  // Beach selection (radio with images)
  beachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  beachRowActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  beachRadio: { marginRight: 10 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#0D9488',
  },
  radioInner: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#0D9488',
  },
  beachThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 10,
  },
  beachInfo: { flex: 1 },
  beachName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  beachMetaRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  metaDot: { width: 5, height: 5, borderRadius: 2.5 },
  metaText: { fontSize: 9, fontWeight: '700' },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
  },
  featureText: { fontSize: 8, fontWeight: '700' },
  infoBtn: { padding: 4 },
  selectedSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDFA', borderRadius: 10, padding: 10, marginTop: 4,
  },
  selectedSummaryText: { fontSize: 13, fontWeight: '600', color: '#0D9488', flex: 1 },

  // Calendar
  calendarContainer: {
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, marginBottom: 4,
  },
  calendarNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  calNavBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekDay: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94A3B8',
  },
  calDaysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
  },
  calDayCellSelected: { backgroundColor: '#0D9488', borderRadius: 10 },
  calDayCellToday: { backgroundColor: '#F0FDFA', borderRadius: 10 },
  calDayText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  calDayTextSelected: { color: '#fff', fontWeight: '800' },
  calDayTextDisabled: { color: '#CBD5E1' },
  calDayTextToday: { color: '#0D9488', fontWeight: '800' },
  selectedDateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDFA', borderRadius: 8, padding: 8, marginTop: 8,
    alignSelf: 'flex-start',
  },
  selectedDateText: { fontSize: 13, fontWeight: '700', color: '#0D9488' },

  // Passengers
  passengersContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 4,
  },
  passengerTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  passengerTypeInfo: {
    flex: 1,
  },
  passengerTypeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  passengerTypePrice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  freeKidsBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  freeKidsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  participantBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    minWidth: 24,
    textAlign: 'center',
  },
  boatFareSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  boatFareText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },

  // Price Summary
  priceSummaryContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceSummaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  priceSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  priceSummaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  priceSummaryGrandLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  priceSummaryGrandValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D9488',
  },
  priceSummaryNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // Inputs
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 4,
    backgroundColor: '#fff',
  },

  // Buttons
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 14,
    borderRadius: 14,
  },
  successText: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '700',
  },

  // Fullscreen modal
  fsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fsClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  fsImage: { width: width - 20, height: width - 20 },
  fsInfo: { alignItems: 'center', marginTop: 16 },
  fsCaption: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  fsLocation: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  fsNav: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 24 },
  fsNavBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  fsCounter: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
});


const addonStyles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    gap: 6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  rowActiveOvernight: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  checkboxOuter: { marginRight: 8 },
  checkboxFilled: {
    width: 20, height: 20, borderRadius: 5, backgroundColor: '#0D9488',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxEmpty: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#CBD5E1',
  },
  iconBg: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  detail: { fontSize: 10, color: '#64748B', marginTop: 1 },
  price: { fontSize: 13, fontWeight: '800', color: '#0D9488', marginLeft: 6 },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6,
  },
  qtyBtn: {
    width: 24, height: 24, borderRadius: 8, backgroundColor: '#F0FDFA',
    borderWidth: 1, borderColor: '#0D9488',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { fontSize: 14, fontWeight: '800', color: '#0F172A', minWidth: 16, textAlign: 'center' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDFA', borderRadius: 10, padding: 10, marginTop: 2,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: '#0D9488' },
  totalPrice: { fontSize: 18, fontWeight: '800', color: '#0D9488' },

  // Overnight expanded
  overnightExpanded: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  nightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nightsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },
  nightsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nightsBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nightsText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5B21B6',
    minWidth: 20,
    textAlign: 'center',
  },
  overnightIncluded: {
    marginBottom: 10,
  },
  overnightIncludedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 6,
  },
  overnightIncludedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  overnightIncludedText: {
    fontSize: 12,
    color: '#5B21B6',
  },
  returnBoatInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  returnBoatText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  overnightTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    padding: 10,
  },
  overnightTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  overnightTotalPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#7C3AED',
  },
});
