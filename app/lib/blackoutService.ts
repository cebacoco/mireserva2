/**
 * blackoutService.ts — Boat reservation blackout periods
 *
 * Reads the [blackout] section from the GitHub config (parsed in configParser).
 * Lets the operator disable boat reservations for a specific beach (or ALL beaches)
 * during one or more date ranges — useful for maintenance, private events, closures, etc.
 *
 * Config format (sync / cebacoco-config.ini):
 *
 *   [blackout]
 *   ; period_N = <beach-id|ALL> | <start YYYY-MM-DD> | <end YYYY-MM-DD> | <optional reason>
 *   period_1=ALL|2026-06-15|2026-06-20|Island maintenance
 *   period_2=coco_loco|2026-07-01|2026-07-05|Private event
 *
 * Multiple periods → multiple period_N entries.
 */

import { getConfig } from './dataService';
import { ConfigBlackout } from './configParser';

/** Normalize any beach name/id to a comparable key: lowercase, non-alnum → underscore. */
function normalizeBeachKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** True if `date` (YYYY-MM-DD) falls within [start, end] inclusive. */
function isDateInRange(date: string, start: string, end: string): boolean {
  // Lexicographic comparison works for zero-padded ISO dates.
  return date >= start && date <= end;
}

function getBlackouts(): ConfigBlackout[] {
  const config = getConfig();
  return config?.blackouts || [];
}

/**
 * Check if boat reservation is blacked out for a given date + beach.
 * A blackout with beach="ALL" applies to every beach.
 * Returns the matching blackout (with reason) or null.
 */
export function getBlackoutFor(date: string, beachName: string): ConfigBlackout | null {
  if (!date) return null;
  const beachKey = normalizeBeachKey(beachName);

  for (const b of getBlackouts()) {
    if (!isDateInRange(date, b.start, b.end)) continue;
    const target = (b.beach || 'ALL').trim();
    if (target.toUpperCase() === 'ALL') return b;
    if (normalizeBeachKey(target) === beachKey) return b;
  }
  return null;
}

/** Convenience boolean wrapper. */
export function isBeachBlackedOut(date: string, beachName: string): boolean {
  return getBlackoutFor(date, beachName) !== null;
}

/** Human-readable reason for a blackout (falls back to a generic message). */
export function getBlackoutReason(date: string, beachName: string): string {
  const b = getBlackoutFor(date, beachName);
  if (!b) return '';
  if (b.reason) return b.reason;
  if ((b.beach || '').toUpperCase() === 'ALL') {
    return `Boat reservations are closed from ${b.start} to ${b.end}. Please choose another date.`;
  }
  return `${beachName} is reserved from ${b.start} to ${b.end}. Please choose another beach or date.`;
}

/**
 * Check if a date is blacked out for ANY beach (used to mark calendar days when
 * no specific beach is selected yet). Only returns true for ALL-beach blackouts.
 */
export function isDateFullyBlackedOut(date: string): boolean {
  if (!date) return false;
  for (const b of getBlackouts()) {
    if ((b.beach || 'ALL').trim().toUpperCase() === 'ALL' && isDateInRange(date, b.start, b.end)) {
      return true;
    }
  }
  return false;
}
