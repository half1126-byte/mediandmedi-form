export function formatEquipment(equipment: string[], models?: Record<string, string>): string {
  return equipment.map((name) => models?.[name]?.trim() ? `${name}: ${models[name].trim()}` : name).join(' · ');
}
