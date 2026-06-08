/**
 * configParser.ts — Parses the simplified cebaco-config.ini
 * 
 * Handles:
 *  - Pipe-delimited arrays (option_1=Mango|2)
 *  - Comma-separated lists (amenities=food,hammocks,shade)
 *  - Numbered keys (gallery_1, gallery_2, photo_1, photo_2)
 *  - Dot-notation sections ([beach.coco_loco], [food.juice_orange])
 *  - Per-section _updated timestamps for caching
 *  - Master [config] section with config_updated for global versioning
 *  - _es suffix fields for Spanish translations
 *
 * TIMESTAMP FORMAT: YYYY-MM-DD-HH-mm (year-month-day-hour-minute)
 */

// ─── Raw parsed types ───

export interface ParsedSection {
  [key: string]: string;
}

export interface ParsedConfig {
  [sectionName: string]: ParsedSection;
}

// ─── Parsed content types (what components consume) ───

export interface ConfigMeta {
  config_updated: string; // YYYY-MM-DD-HH-mm
  app_name: string;
  app_name_es?: string;
  github_url: string;
}

export interface ConfigHero {
  tagline: string;
  tagline_es?: string;
  title: string;
  title_es?: string;
  subtitle: string;
  subtitle_es?: string;
  background_image: string;
  cta_text: string;
  cta_text_es?: string;
  logo_text: string;
  logo_text_es?: string;
  stats: { number: string; label: string }[];
  stats_es?: { number: string; label: string }[];
}

export interface ConfigBeach {
  id: string; // section key, e.g. "coco_loco"
  name: string;
  island: string;
  description: string;
  description_es?: string;
  privacy_score: number;
  capacity: number;
  amenities: string[];
  panga_available: boolean;
  panga_schedule: string;
  panga_schedule_es?: string;
  image: string;
  booking_image: string;
  features: string[];
  has_chill_gym: boolean;
}

export interface ConfigBeachGalleryPhoto {
  url: string;
  caption: string;
}

export interface ConfigFoodItem {
  id: string; // section key
  name: string;
  name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  image: string;
  category: string;
  options: { label: string; price: number }[];
  options_es?: { label: string; price: number }[];
  addons: { label: string; price: number }[];
  addons_es?: { label: string; price: number }[];
}


export interface ConfigWaterItem {
  id: string;
  name: string;
  name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  price_label: string;
  price_label_es?: string;
  image: string;
  details: string[];
  details_es?: string[];
  kayak_options?: { id: string; name: string; price: number; priceLabel: string; details: string }[];
}

export interface ConfigIslandItem {
  id: string;
  name: string;
  name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  price_label: string;
  price_label_es?: string;
  image: string;
  details: string[];
  details_es?: string[];
  gallery: string[];
}

export interface ConfigFishingItem {
  id: string;
  name: string;
  name_es?: string;
  display_name: string;
  display_name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  duration: string;
  duration_es?: string;
  max_participants: number;
  equipment: string[];
  equipment_es?: string[];
  image: string;
  subtitle: string;
  subtitle_es?: string;
  angler_cost?: number;
  included?: string[];
  included_es?: string[];
}

export interface ConfigOvernight {
  name: string;
  name_es?: string;
  description: string;
  description_es?: string;
  price: number;
  price_label: string;
  price_label_es?: string;
  image: string;
  price_night_1: number;
  price_night_2: number;
  price_night_3_plus: number;
  max_nights: number;
  pitch_text: string;
  pitch_text_es?: string;
  sleep_options: { name: string; description: string }[];
  sleep_options_es?: { name: string; description: string }[];
  honest_title: string;
  honest_title_es?: string;
  honest_text: string;
  honest_text_es?: string;
  details: string[];
  details_es?: string[];
  gallery: { url: string; label: string }[];
}




export interface ConfigBoatBooking {
  title: string;
  title_es?: string;
  subtitle: string;
  subtitle_es?: string;
  price_per_adult: number;
  kids_free_under: number;
  service_fee: number;
  service_fee_note: string;
  service_fee_note_es?: string;
  internet_price_per_phone: number;
  charging_price_per_phone: number;
  shower_price_per_person: number;
  kitchen_price_per_group: number;
  chill_gym_price_per_person: number;
  overnight_price_night_1: number;
  overnight_price_night_2: number;
  overnight_price_night_3_plus: number;
  overnight_max_nights: number;
  overnight_includes: string[];
  overnight_includes_es?: string[];
  overnight_return_note: string;
  overnight_return_note_es?: string;
  inshore_fishing_addon_price: number;
  inshore_fishing_addon_desc: string;
  inshore_fishing_addon_desc_es?: string;
}

export interface ConfigFooter {
  brand_name: string;
  brand_name_es?: string;
  copyright: string;
  copyright_es?: string;
  info_beach: string;
  info_beach_es?: string;
  info_app: string;
  info_app_es?: string;
  whatsapp_number: string;
  whatsapp_url: string;
  email: string;
}

// ─── Blackout periods — boat reservation disabled for a beach (or ALL) during a date range ───
export interface ConfigBlackout {
  beach: string;       // beach id like "coco_loco", or "ALL" for every beach
  start: string;       // YYYY-MM-DD (inclusive)
  end: string;         // YYYY-MM-DD (inclusive)
  reason?: string;     // optional human-readable reason
}


export interface ConfigFishing {
  intro_text: string;
  intro_text_es?: string;
  central_image: string;
  items: ConfigFishingItem[];
}

// ─── Section timestamps ───
export interface SectionTimestamps {
  [sectionName: string]: string; // YYYY-MM-DD-HH-mm
}

// ─── Full parsed config ───
export interface AppConfig {
  meta?: ConfigMeta;
  hero?: ConfigHero;
  beaches: ConfigBeach[];
  beachGallery: ConfigBeachGalleryPhoto[];
  boatBooking?: ConfigBoatBooking;
  food: ConfigFoodItem[];
  foodFreshNote?: string;
  foodFreshNoteEs?: string;
  water: ConfigWaterItem[];
  waterIntroText?: string;
  waterIntroTextEs?: string;
  island: ConfigIslandItem[];
  islandIntroText?: string;
  islandIntroTextEs?: string;
  fishing?: ConfigFishing;
  overnight?: ConfigOvernight;
  footer?: ConfigFooter;
  blackouts: ConfigBlackout[];

  timestamps: SectionTimestamps;
  // ─── UI Strings from [strings_en] and [strings_es] sections ───
  strings_en?: Record<string, string>;
  strings_es?: Record<string, string>;
}



// ═══════════════════════════════════════════════════════════════
// INI PARSER
// ═══════════════════════════════════════════════════════════════

export function parseINI(text: string): ParsedConfig {
  const config: ParsedConfig = {};
  let currentSection = '';

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith(';')) continue;

    // Section header
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!config[currentSection]) {
        config[currentSection] = {};
      }
      continue;
    }

    // Key=value pair
    if (currentSection) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.substring(0, eqIdx).trim();
        const value = line.substring(eqIdx + 1).trim();
        config[currentSection][key] = value;
      }
    }
  }

  return config;
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════

/** Get all sections matching a prefix, e.g. "beach." returns beach.coco_loco, beach.coco_blanco, etc. */
function getSectionsWithPrefix(config: ParsedConfig, prefix: string): [string, ParsedSection][] {
  return Object.entries(config).filter(([key]) => key.startsWith(prefix + '.'));
}

/** Extract numbered keys like photo_1, photo_2 → ordered array of values */
function getNumberedValues(section: ParsedSection, prefix: string): string[] {
  const entries: [number, string][] = [];
  for (const [key, value] of Object.entries(section)) {
    const match = key.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (match) {
      entries.push([parseInt(match[1]), value]);
    }
  }
  return entries.sort((a, b) => a[0] - b[0]).map(e => e[1]);
}

/** Extract numbered keys with _es suffix like option_1_es, option_2_es → ordered array of values */
function getNumberedValuesEs(section: ParsedSection, prefix: string): string[] {
  const entries: [number, string][] = [];
  for (const [key, value] of Object.entries(section)) {
    const match = key.match(new RegExp(`^${prefix}_(\\d+)_es$`));
    if (match) {
      entries.push([parseInt(match[1]), value]);
    }
  }
  return entries.sort((a, b) => a[0] - b[0]).map(e => e[1]);
}


/** Parse pipe-delimited value: "Mango|2" → { label: "Mango", price: 2 } */
function parseLabelPrice(value: string): { label: string; price: number } {
  const parts = value.split('|');
  return { label: parts[0], price: parseFloat(parts[1]) || 0 };
}

/** Parse pipe-delimited photo: "url|caption" */
function parsePhotoCaption(value: string): { url: string; caption: string } {
  const pipeIdx = value.indexOf('|');
  if (pipeIdx === -1) return { url: value, caption: '' };
  return { url: value.substring(0, pipeIdx), caption: value.substring(pipeIdx + 1) };
}

/** Parse pipe-delimited name|description */
function parseNameDesc(value: string): { name: string; description: string } {
  const parts = value.split('|');
  return { name: parts[0], description: parts[1] || '' };
}

/** Parse comma-separated list */
function parseCSV(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function num(value: string | undefined, fallback: number = 0): number {
  if (!value) return fallback;
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}

function bool(value: string | undefined, fallback: boolean = true): boolean {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

// ═══════════════════════════════════════════════════════════════
// SECTION TIMESTAMP EXTRACTION
// ═══════════════════════════════════════════════════════════════

export function extractTimestamps(config: ParsedConfig): SectionTimestamps {
  const timestamps: SectionTimestamps = {};
  for (const [sectionName, section] of Object.entries(config)) {
    if (section._updated) {
      timestamps[sectionName] = section._updated;
    }
  }
  return timestamps;
}

/**
 * Extract the master config_updated date from [config] section.
 * Returns YYYY-MM-DD-HH-mm string or empty string if not found.
 */
export function extractConfigVersion(config: ParsedConfig): string {
  return config.config?.config_updated || '';
}

// ═══════════════════════════════════════════════════════════════
// CONVERT PARSED INI → APP CONFIG
// ═══════════════════════════════════════════════════════════════

export function buildAppConfig(config: ParsedConfig): AppConfig {
  const timestamps = extractTimestamps(config);

  // ─── Meta ───
  let meta: ConfigMeta | undefined;
  if (config.config) {
    const c = config.config;
    meta = {
      config_updated: c.config_updated || '',
      app_name: c.app_name || '',
      app_name_es: c.app_name_es || undefined,
      github_url: c.github_url || '',
    };
  }

  // ─── Hero ───
  let hero: ConfigHero | undefined;
  if (config.hero) {
    const h = config.hero;
    const stats: { number: string; label: string }[] = [];
    for (const val of getNumberedValues(h, 'stat')) {
      const parts = val.split('|');
      stats.push({ number: parts[0], label: parts[1] || '' });
    }
    const statsEsRaw = getNumberedValuesEs(h, 'stat');
    const stats_es = statsEsRaw.length > 0 ? statsEsRaw.map(v => {
      const parts = v.split('|');
      return { number: parts[0], label: parts[1] || '' };
    }) : undefined;

    hero = {
      tagline: h.tagline || '',
      tagline_es: h.tagline_es || undefined,
      title: (h.title || '').replace(/\\n/g, '\n'),
      title_es: h.title_es ? h.title_es.replace(/\\n/g, '\n') : undefined,
      subtitle: h.subtitle || '',
      subtitle_es: h.subtitle_es || undefined,
      background_image: h.background_image || '',
      cta_text: h.cta_text || '',
      cta_text_es: h.cta_text_es || undefined,
      logo_text: h.logo_text || '',
      logo_text_es: h.logo_text_es || undefined,
      stats,
      stats_es,
    };
  }

  // ─── Beaches ───
  const beaches: ConfigBeach[] = [];
  for (const [sectionKey, section] of getSectionsWithPrefix(config, 'beach')) {
    const id = sectionKey.replace('beach.', '');
    beaches.push({
      id,
      name: section.name || id,
      island: section.island || '',
      description: section.description || '',
      description_es: section.description_es || undefined,
      privacy_score: num(section.privacy_score),
      capacity: num(section.capacity, 20),
      amenities: parseCSV(section.amenities),
      panga_available: bool(section.panga_available),
      panga_schedule: section.panga_schedule || '',
      panga_schedule_es: section.panga_schedule_es || undefined,
      image: section.image || '',
      booking_image: section.booking_image || '',
      features: parseCSV(section.features),
      has_chill_gym: bool(section.has_chill_gym, false),
    });
  }

  // ─── Beach Gallery ───
  const beachGallery: ConfigBeachGalleryPhoto[] = [];
  if (config.beach_gallery) {
    for (const val of getNumberedValues(config.beach_gallery, 'photo')) {
      const { url, caption } = parsePhotoCaption(val);
      beachGallery.push({ url, caption });
    }
  }

  // ─── Boat Booking ───
  let boatBooking: ConfigBoatBooking | undefined;
  if (config.boat_booking) {
    const b = config.boat_booking;
    boatBooking = {
      title: b.title || '',
      title_es: b.title_es || undefined,
      subtitle: b.subtitle || '',
      subtitle_es: b.subtitle_es || undefined,
      price_per_adult: num(b.price_per_adult, 50),
      kids_free_under: num(b.kids_free_under, 8),
      service_fee: num(b.service_fee, 10),
      service_fee_note: b.service_fee_note || '',
      service_fee_note_es: b.service_fee_note_es || undefined,
      internet_price_per_phone: num(b.internet_price_per_phone, 5),
      charging_price_per_phone: num(b.charging_price_per_phone, 5),
      shower_price_per_person: num(b.shower_price_per_person, 10),
      kitchen_price_per_group: num(b.kitchen_price_per_group, 50),
      chill_gym_price_per_person: num(b.chill_gym_price_per_person, 10),
      overnight_price_night_1: num(b.overnight_price_night_1, 100),
      overnight_price_night_2: num(b.overnight_price_night_2, 50),
      overnight_price_night_3_plus: num(b.overnight_price_night_3_plus, 30),
      overnight_max_nights: num(b.overnight_max_nights, 14),
      overnight_includes: parseCSV(b.overnight_includes),
      overnight_includes_es: b.overnight_includes_es ? parseCSV(b.overnight_includes_es) : undefined,
      overnight_return_note: b.overnight_return_note || '',
      overnight_return_note_es: b.overnight_return_note_es || undefined,
      inshore_fishing_addon_price: num(b.inshore_fishing_addon_price, 300),
      inshore_fishing_addon_desc: b.inshore_fishing_addon_desc || '',
      inshore_fishing_addon_desc_es: b.inshore_fishing_addon_desc_es || undefined,
    };
  }

  // ─── Food ───
  const food: ConfigFoodItem[] = [];
  const foodFreshNote = config.food?.fresh_note;
  const foodFreshNoteEs = config.food?.fresh_note_es;
  for (const [sectionKey, section] of getSectionsWithPrefix(config, 'food')) {
    const id = sectionKey.replace('food.', '');
    const options: { label: string; price: number }[] = [];
    for (const val of getNumberedValues(section, 'option')) {
      options.push(parseLabelPrice(val));
    }
    const addons: { label: string; price: number }[] = [];
    for (const val of getNumberedValues(section, 'addon')) {
      addons.push(parseLabelPrice(val));
    }
    const optionsEsRaw = getNumberedValuesEs(section, 'option');
    const options_es = optionsEsRaw.length > 0 ? optionsEsRaw.map(v => parseLabelPrice(v)) : undefined;
    const addonsEsRaw = getNumberedValuesEs(section, 'addon');
    const addons_es = addonsEsRaw.length > 0 ? addonsEsRaw.map(v => parseLabelPrice(v)) : undefined;

    food.push({
      id: section.id || id,
      name: section.name || id,
      name_es: section.name_es || undefined,
      description: section.description || '',
      description_es: section.description_es || undefined,
      price: num(section.price),
      image: section.image || '',
      category: section.category || 'snacks',
      options,
      options_es,
      addons,
      addons_es,
    });
  }

  // ─── Water ───
  const water: ConfigWaterItem[] = [];
  const waterIntroText = config.water?.intro_text;
  const waterIntroTextEs = config.water?.intro_text_es;
  for (const [sectionKey, section] of getSectionsWithPrefix(config, 'water')) {
    const id = sectionKey.replace('water.', '');
    const kayakOptions: ConfigWaterItem['kayak_options'] = [];
    for (const val of getNumberedValues(section, 'kayak')) {
      const parts = val.split('|');
      if (parts.length >= 5) {
        kayakOptions.push({
          id: parts[0],
          name: parts[1],
          price: parseFloat(parts[2]) || 0,
          priceLabel: parts[3],
          details: parts[4],
        });
      }
    }

    water.push({
      id: section.id || id,
      name: section.name || id,
      name_es: section.name_es || undefined,
      description: section.description || '',
      description_es: section.description_es || undefined,
      price: num(section.price),
      price_label: section.price_label || '',
      price_label_es: section.price_label_es || undefined,
      image: section.image || '',
      details: parseCSV(section.details),
      details_es: section.details_es ? parseCSV(section.details_es) : undefined,
      kayak_options: kayakOptions.length > 0 ? kayakOptions : undefined,
    });
  }

  // ─── Island ───
  const island: ConfigIslandItem[] = [];
  const islandIntroText = config.island?.intro_text;
  const islandIntroTextEs = config.island?.intro_text_es;
  for (const [sectionKey, section] of getSectionsWithPrefix(config, 'island')) {
    const id = sectionKey.replace('island.', '');
    const gallery = getNumberedValues(section, 'gallery');
    island.push({
      id: section.id || id,
      name: section.name || id,
      name_es: section.name_es || undefined,
      description: section.description || '',
      description_es: section.description_es || undefined,
      price: num(section.price),
      price_label: section.price_label || '',
      price_label_es: section.price_label_es || undefined,
      image: section.image || '',
      details: parseCSV(section.details),
      details_es: section.details_es ? parseCSV(section.details_es) : undefined,
      gallery,
    });
  }

  // ─── Fishing ───
  let fishing: ConfigFishing | undefined;
  const fishingItems: ConfigFishingItem[] = [];
  for (const [sectionKey, section] of getSectionsWithPrefix(config, 'fishing')) {
    const id = sectionKey.replace('fishing.', '');
    fishingItems.push({
      id,
      name: section.name || id,
      name_es: section.name_es || undefined,
      display_name: section.display_name || section.name || id,
      display_name_es: section.display_name_es || undefined,
      description: section.description || '',
      description_es: section.description_es || undefined,
      price: num(section.price),
      duration: section.duration || '',
      duration_es: section.duration_es || undefined,
      max_participants: num(section.max_participants, 4),
      equipment: parseCSV(section.equipment),
      equipment_es: section.equipment_es ? parseCSV(section.equipment_es) : undefined,
      image: section.image || '',
      subtitle: section.subtitle || '',
      subtitle_es: section.subtitle_es || undefined,
      angler_cost: section.angler_cost ? num(section.angler_cost) : undefined,
      included: section.included ? parseCSV(section.included) : undefined,
      included_es: section.included_es ? parseCSV(section.included_es) : undefined,
    });
  }
  if (config.fishing || fishingItems.length > 0) {
    fishing = {
      intro_text: config.fishing?.intro_text || '',
      intro_text_es: config.fishing?.intro_text_es || undefined,
      central_image: config.fishing?.central_image || '',
      items: fishingItems,
    };
  }

  // ─── Overnight ───
  let overnight: ConfigOvernight | undefined;
  if (config.overnight) {
    const o = config.overnight;
    const sleepOptions: { name: string; description: string }[] = [];
    for (const val of getNumberedValues(o, 'sleep_option')) {
      sleepOptions.push(parseNameDesc(val));
    }
    const sleepOptionsEsRaw = getNumberedValuesEs(o, 'sleep_option');
    const sleep_options_es = sleepOptionsEsRaw.length > 0
      ? sleepOptionsEsRaw.map(v => parseNameDesc(v))
      : undefined;

    const gallery: { url: string; label: string }[] = [];
    for (const val of getNumberedValues(o, 'gallery')) {
      const { url, caption } = parsePhotoCaption(val);
      gallery.push({ url, label: caption });
    }
    overnight = {
      name: o.name || '',
      name_es: o.name_es || undefined,
      description: o.description || '',
      description_es: o.description_es || undefined,
      price: num(o.price, 100),
      price_label: o.price_label || '',
      price_label_es: o.price_label_es || undefined,
      image: o.image || '',
      price_night_1: num(o.price_night_1, 100),
      price_night_2: num(o.price_night_2, 50),
      price_night_3_plus: num(o.price_night_3_plus, 30),
      max_nights: num(o.max_nights, 14),
      pitch_text: o.pitch_text || '',
      pitch_text_es: o.pitch_text_es || undefined,
      sleep_options: sleepOptions,
      sleep_options_es,
      honest_title: o.honest_title || '',
      honest_title_es: o.honest_title_es || undefined,
      honest_text: o.honest_text || '',
      honest_text_es: o.honest_text_es || undefined,
      details: parseCSV(o.details),
      details_es: o.details_es ? parseCSV(o.details_es) : undefined,
      gallery,
    };
  }

  // ─── Footer ───
  let footer: ConfigFooter | undefined;
  if (config.footer) {
    const f = config.footer;
    footer = {
      brand_name: f.brand_name || '',
      brand_name_es: f.brand_name_es || undefined,
      copyright: f.copyright || '',
      copyright_es: f.copyright_es || undefined,
      info_beach: f.info_beach || '',
      info_beach_es: f.info_beach_es || undefined,
      info_app: f.info_app || '',
      info_app_es: f.info_app_es || undefined,
      whatsapp_number: f.whatsapp_number || '',
      whatsapp_url: f.whatsapp_url || '',
      email: f.email || '',
    };
  }

  // ─── Blackout periods ───
  // [blackout] section. Each entry: period_N=<beach|ALL>|<start YYYY-MM-DD>|<end YYYY-MM-DD>|<optional reason>
  const blackouts: ConfigBlackout[] = [];
  if (config.blackout) {
    for (const val of getNumberedValues(config.blackout, 'period')) {
      const parts = val.split('|').map(p => p.trim());
      if (parts.length >= 3 && parts[1] && parts[2]) {
        blackouts.push({
          beach: parts[0] || 'ALL',
          start: parts[1],
          end: parts[2],
          reason: parts[3] || undefined,
        });
      }
    }
  }

  // ─── UI Strings [strings_en] and [strings_es] ───
  const strings_en: Record<string, string> | undefined = config.strings_en
    ? { ...config.strings_en }
    : undefined;
  const strings_es: Record<string, string> | undefined = config.strings_es
    ? { ...config.strings_es }
    : undefined;

  return {
    meta,
    hero,
    beaches,
    beachGallery,
    boatBooking,
    food,
    foodFreshNote,
    foodFreshNoteEs,
    water,
    waterIntroText,
    waterIntroTextEs,
    island,
    islandIntroText,
    islandIntroTextEs,
    fishing,
    overnight,
    footer,
    blackouts,

    timestamps,
    strings_en,
    strings_es,
  };
}

