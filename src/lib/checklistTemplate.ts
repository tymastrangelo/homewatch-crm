import type { ChecklistItemStatus } from './types'

export type ChecklistCategory = 'exterior' | 'interior' | 'security' | 'lanai_pool' | 'final'

export type ChecklistTemplateItem = {
  /** Stable identifier, persisted as checklist_items.item_key */
  key: string
  category: ChecklistCategory
  label: string
  /** Rendering / persistence order, persisted as checklist_items.sort_order */
  sortOrder: number
}

/**
 * The canonical "Basic Home Watch Checklist" used by 239 Home Services.
 * This is the single source of truth — the form, detail view, PDF report,
 * and the database backfill all derive their ordering and labels from here.
 */
export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'forced_entry', category: 'exterior', label: 'Visual check for evidence of forced entry, vandalism, theft or damage', sortOrder: 10 },
  { key: 'yard_maintenance', category: 'exterior', label: 'Visual inspection of yard/landscaping to assure regular maintenance', sortOrder: 20 },
  { key: 'outdoor_fixtures', category: 'exterior', label: 'Visual inspection of outdoor light fixtures, fencing, windows, screens, and mailbox', sortOrder: 30 },
  { key: 'hose_faucet', category: 'exterior', label: 'Check exterior hose and faucet for leaks', sortOrder: 40 },
  { key: 'remove_mail', category: 'exterior', label: 'Removal of newspapers, flyers, packages, mail and other evidence of non-occupancy', sortOrder: 50 },
  { key: 'roof_gutters', category: 'exterior', label: 'Visual inspection of roof and gutters from the ground', sortOrder: 60 },
  { key: 'interior_theft', category: 'interior', label: 'Inspect for signs of theft, vandalism, damage or other disturbance', sortOrder: 70 },
  { key: 'fuse_box', category: 'interior', label: 'Check fuse box for tripped breakers or evidence of power surge', sortOrder: 80 },
  { key: 'water_supply', category: 'interior', label: 'Turn on water supply if turned off', sortOrder: 90 },
  { key: 'hot_water_heater', category: 'interior', label: 'Visual check of hot water heater', sortOrder: 100 },
  { key: 'hvac', category: 'interior', label: 'Visual check of HVAC', sortOrder: 110 },
  { key: 'thermostat', category: 'interior', label: 'Check that thermostat is set at correct temperature', sortOrder: 120 },
  { key: 'temps', category: 'interior', label: 'Document interior temperature levels (Garage/Storage, Main Floor, 2nd Zone, 3rd Floor)', sortOrder: 130 },
  { key: 'secure_windows', category: 'security', label: 'Check that all windows and entryways are secure', sortOrder: 140 },
  { key: 'security_system', category: 'security', label: 'Check security system is set and working properly', sortOrder: 150 },
  { key: 'lighting', category: 'interior', label: 'Check interior and exterior lighting', sortOrder: 160 },
  { key: 'lights_operation', category: 'interior', label: 'Operation of all lights - interior and exterior', sortOrder: 170 },
  { key: 'water_damage', category: 'interior', label: 'Visual inspection of walls, ceilings, windows, tubs/showers for evidence of water damage, leakage, mold', sortOrder: 180 },
  { key: 'water_lines', category: 'interior', label: 'Water flex lines and drains – Run sinks and toilets', sortOrder: 190 },
  { key: 'garbage_disposal', category: 'interior', label: 'Garbage disposal(s)', sortOrder: 200 },
  { key: 'pests', category: 'interior', label: 'Inspect for visible evidence of insects, pests, rodents', sortOrder: 210 },
  { key: 'appliances', category: 'interior', label: 'Visual check of appliances', sortOrder: 220 },
  { key: 'freezers', category: 'interior', label: 'Check that freezers, refrigerators and wine coolers are working', sortOrder: 230 },
  { key: 'icemaker', category: 'interior', label: 'Ensure icemakers are in "off" position', sortOrder: 240 },
  { key: 'clocks', category: 'interior', label: 'Check clocks settings - reset if needed', sortOrder: 250 },
  { key: 'lanai_screens', category: 'lanai_pool', label: 'Lanai/Pool - Screen door(s), screens, and cage structure', sortOrder: 260 },
  { key: 'lanai_water', category: 'lanai_pool', label: 'Lanai/Pool - Water level and condition', sortOrder: 270 },
  { key: 'lanai_equipment', category: 'lanai_pool', label: 'Lanai/Pool - Equipment', sortOrder: 280 },
  { key: 'final_hot_water', category: 'final', label: 'Turn off hot water heater', sortOrder: 290 },
  { key: 'final_water_supply', category: 'final', label: 'Turn off water supply', sortOrder: 300 },
  { key: 'final_lights', category: 'final', label: 'Turn off all lights', sortOrder: 310 },
  { key: 'final_security', category: 'final', label: 'Enable security system (if applicable) and lock all doors and windows', sortOrder: 320 }
]

export const CATEGORY_LABELS: Record<string, string> = {
  exterior: 'Exterior',
  interior: 'Interior',
  security: 'Security',
  lanai_pool: 'Lanai / Pool',
  final: 'Final tasks'
}

export const CATEGORY_ORDER: ChecklistCategory[] = ['exterior', 'interior', 'security', 'lanai_pool', 'final']

export function categoryLabel(key: string): string {
  return (
    CATEGORY_LABELS[key] ??
    key
      .split('_')
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  )
}

export const STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  done: 'OK',
  na: 'N/A',
  issue: 'Issue',
  unchecked: 'Not checked'
}

/** Returns the canonical sort order for a given item, falling back to the end. */
export function templateSortOrder(itemKey: string | null, itemText: string): number {
  const byKey = itemKey ? CHECKLIST_TEMPLATE.find(t => t.key === itemKey) : undefined
  if (byKey) return byKey.sortOrder
  const byText = CHECKLIST_TEMPLATE.find(t => t.label === itemText)
  return byText ? byText.sortOrder : 1000
}
