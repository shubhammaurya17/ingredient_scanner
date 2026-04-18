export const formatValue = (v: string | number | undefined | null, defaultUnit: string) => {
  if (v === undefined || v === null) return `0 ${defaultUnit}`;
  if (typeof v === 'number') return `${v} ${defaultUnit}`;
  
  const str = String(v);
  
  // Extract the first number found
  const numMatch = str.match(/[0-9.]+/);
  const numPart = numMatch ? numMatch[0] : '';
  
  // Extract the unit part (everything after the first number)
  const unitMatch = str.match(/[a-zA-Z% /]+/);
  let unitPart = (unitMatch && unitMatch[0]) ? unitMatch[0].trim().toLowerCase() : '';
  
  // Normalize units
  if (unitPart.includes('mlg') || unitPart.includes('milligram')) unitPart = 'mg';
  else if (unitPart.includes('gg') || unitPart.includes('gram')) unitPart = 'g';
  else if (unitPart.includes('kcal') || unitPart.includes('calorie')) unitPart = 'kcal';
  else if (unitPart.includes('ml') || unitPart.includes('milliliter')) unitPart = 'ml';
  
  // Simplify complex units (e.g., "g per ml" -> "g", "mg/100ml" -> "mg")
  if (unitPart.includes('per')) {
    unitPart = unitPart.split('per')[0].trim();
  }
  if (unitPart.includes('/')) {
    unitPart = unitPart.split('/')[0].trim();
  }

  // Final cleanup of unitPart to keep only the first word or standard unit
  const simpleUnits = ['g', 'mg', 'kcal', 'ml', '%'];
  const foundSimple = simpleUnits.find(u => unitPart.startsWith(u));
  if (foundSimple) unitPart = foundSimple;

  if (!unitPart) unitPart = defaultUnit;
  
  return `${numPart} ${unitPart}`;
};
