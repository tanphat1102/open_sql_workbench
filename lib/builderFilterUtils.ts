import type { SapSqlwbField } from "@/types/sap";

export const NUMERIC_ABAP_TYPES = new Set([
  "INT1",
  "INT2",
  "INT4",
  "INT8",
  "DEC",
  "CURR",
  "QUAN",
  "FLTP",
  "I",
  "P",
  "F",
  "B",
  "S",
]);

export const STRING_ABAP_TYPES = new Set([
  "NUMC",
  "CHAR",
  "DATS",
  "TIMS",
  "STRING",
  "RAW",
  "SSTRING",
  "C",
  "N",
  "D",
  "T",
]);

export function isNumericField(
  fieldObj?: Partial<SapSqlwbField> | null,
): boolean {
  if (!fieldObj) return false;

  const abapType = (fieldObj.AbapType || "").toUpperCase().trim();
  if (abapType && NUMERIC_ABAP_TYPES.has(abapType)) {
    return true;
  }

  const element = (fieldObj.Element || "").toUpperCase().trim();
  if (element && NUMERIC_ABAP_TYPES.has(element)) {
    return true;
  }

  return false;
}

export function formatWhereValue(
  value: string,
  fieldObj?: Partial<SapSqlwbField> | null,
): string {
  const trimmedValue = value.trim();

  // If user explicitly entered single quotes e.g. "'0001'" or "'100'", preserve it without double quoting!
  if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
    return trimmedValue;
  }

  const isNumericValue = /^-?\d+(\.\d+)?$/.test(trimmedValue);

  // Only omit single quotes if the field is confirmed as a true numeric ABAP type (INT, DEC, CURR, QUAN, FLTP)
  // NUMC (Numeric Character IDs like '0001'), CHAR, DATS, TIMS, STRING MUST be quoted in SAP Open SQL!
  // Raw input value string is preserved directly to prevent losing leading zeros (e.g. 0001 -> '0001').
  if (isNumericValue && isNumericField(fieldObj)) {
    return trimmedValue;
  }

  return `'${trimmedValue.replace(/'/g, "''")}'`;
}

export function formatInValue(
  value: string,
  fieldObj?: Partial<SapSqlwbField> | null,
): string {
  let trimmed = value.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  const items = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => formatWhereValue(item, fieldObj));

  if (items.length === 0) return "( )";
  return `( ${items.join(", ")} )`;
}
