import type { StoreProduct } from "./products";

export type FilterGroupId =
  | "type"
  | "goal"
  | "age"
  | "gender"
  | "brand"
  | "diet";

export type FilterGroupConfig = {
  id: FilterGroupId;
  label: string;
  tagPrefix?: string;
};

export const FILTER_GROUPS: FilterGroupConfig[] = [
  { id: "type", label: "Product Type" },
  { id: "goal", label: "Health Goal", tagPrefix: "goal:" },
  { id: "age", label: "Age Cohort", tagPrefix: "cohort-age:" },
  { id: "gender", label: "Gender", tagPrefix: "cohort-gender:" },
  { id: "brand", label: "Brand", tagPrefix: "brand:" },
  { id: "diet", label: "Diet", tagPrefix: "diet:" },
];

export type ActiveFilters = Record<FilterGroupId, string[]>;

export type FilterOption = {
  value: string;
  label: string;
  count: number;
};

export type FilterFacetGroup = {
  id: FilterGroupId;
  label: string;
  options: FilterOption[];
};

const PRODUCT_TYPE_ORDER = [
  "Supplement",
  "Peptide",
  "Test Kit",
  "Protein",
  "Performance",
  "Wellness",
  "Bundle",
] as const;

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  Supplement: "Supplements",
  Peptide: "Peptides",
  "Test Kit": "Test Kits",
  Protein: "Protein",
  Performance: "Performance",
  Wellness: "Wellness",
  Bundle: "Bundles",
};

const GOAL_ORDER = [
  "hormone-balance",
  "energy",
  "anti-aging",
  "cardiovascular",
  "longevity",
  "immunity",
  "inflammation",
  "weight-loss",
  "muscle-growth",
  "gut-health",
  "recovery",
  "thyroid",
  "fat-loss",
  "skin",
  "sleep",
  "hair-growth",
  "sexual-health",
  "cognition",
  "detox",
] as const;

const AGE_ORDER = ["all", "20", "40", "80"] as const;
const GENDER_ORDER = ["all", "female", "male"] as const;

const DIET_ORDER = [
  "vegan",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "keto",
  "paleo",
] as const;

function emptyActiveFilters(): ActiveFilters {
  return {
    type: [],
    goal: [],
    age: [],
    gender: [],
    brand: [],
    diet: [],
  };
}

function parseParamList(param: string | undefined): string[] {
  if (!param) return [];
  return param
    .split(",")
    .map((value) => decodeURIComponent(value.trim()))
    .filter(Boolean);
}

export function parseActiveFilters(
  searchParams: Record<string, string | undefined>,
): ActiveFilters {
  return {
    type: parseParamList(searchParams.type),
    goal: parseParamList(searchParams.goal),
    age: parseParamList(searchParams.age),
    gender: parseParamList(searchParams.gender),
    brand: parseParamList(searchParams.brand),
    diet: parseParamList(searchParams.diet),
  };
}

function formatTagLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function productMatchesTag(
  product: Pick<StoreProduct, "tags">,
  prefix: string,
  value: string,
): boolean {
  return product.tags.some((tag) => tag === `${prefix}${value}`);
}

function productMatchesGroup(
  product: Pick<StoreProduct, "productType" | "tags">,
  groupId: FilterGroupId,
  values: string[],
): boolean {
  if (values.length === 0) return true;

  if (groupId === "type") {
    return values.includes(product.productType);
  }

  const group = FILTER_GROUPS.find((item) => item.id === groupId);
  if (!group?.tagPrefix) return true;

  return values.some((value) =>
    productMatchesTag(product, group.tagPrefix!, value),
  );
}

export function filterStoreProducts(
  products: StoreProduct[],
  active: ActiveFilters,
): StoreProduct[] {
  return products.filter((product) =>
    FILTER_GROUPS.every((group) =>
      productMatchesGroup(product, group.id, active[group.id]),
    ),
  );
}

function sortByOrder<T extends string>(
  values: Iterable<T>,
  order: readonly T[],
): T[] {
  const set = new Set(values);
  const ordered = order.filter((value) => set.has(value));
  const rest = [...set]
    .filter((value) => !order.includes(value))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

function countForOption(
  products: StoreProduct[],
  groupId: FilterGroupId,
  value: string,
  active: ActiveFilters,
): number {
  const relaxed = { ...active, [groupId]: [] as string[] };
  return products.filter(
    (product) =>
      FILTER_GROUPS.every((group) => {
        const values =
          group.id === groupId ? [value] : relaxed[group.id];
        return productMatchesGroup(product, group.id, values);
      }),
  ).length;
}

function collectTagValues(
  products: StoreProduct[],
  prefix: string,
): string[] {
  const values = new Set<string>();
  for (const product of products) {
    for (const tag of product.tags) {
      if (tag.startsWith(prefix)) {
        values.add(tag.slice(prefix.length));
      }
    }
  }
  return [...values];
}

export function buildFilterFacets(
  products: StoreProduct[],
  active: ActiveFilters,
): FilterFacetGroup[] {
  const typeValues = new Set(
    products.map((product) => product.productType).filter(Boolean),
  );
  for (const type of PRODUCT_TYPE_ORDER) {
    typeValues.add(type);
  }

  const goalValues = collectTagValues(products, "goal:");
  const ageValues = collectTagValues(products, "cohort-age:");
  const genderValues = collectTagValues(products, "cohort-gender:");
  const brandValues = collectTagValues(products, "brand:");
  const dietValues = collectTagValues(products, "diet:");

  const facetValues: Record<FilterGroupId, string[]> = {
    type: sortByOrder(typeValues, PRODUCT_TYPE_ORDER),
    goal: sortByOrder(goalValues, GOAL_ORDER),
    age: sortByOrder(ageValues, AGE_ORDER),
    gender: sortByOrder(genderValues, GENDER_ORDER),
    brand: sortByOrder(brandValues, []),
    diet: sortByOrder(
      new Set([...dietValues, ...DIET_ORDER]),
      DIET_ORDER,
    ),
  };

  return FILTER_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    options: facetValues[group.id].map((value) => ({
      value,
      label:
        group.id === "type"
          ? (PRODUCT_TYPE_LABELS[value] ?? value)
          : formatTagLabel(value),
      count: countForOption(products, group.id, value, active),
    })),
  }));
}

export function buildStoreSearchParams(
  active: ActiveFilters,
  toggle: { groupId: FilterGroupId; value: string },
): URLSearchParams {
  const next = { ...active };
  const current = next[toggle.groupId];
  const exists = current.includes(toggle.value);

  next[toggle.groupId] = exists
    ? current.filter((item) => item !== toggle.value)
    : [...current, toggle.value];

  const params = new URLSearchParams();
  for (const group of FILTER_GROUPS) {
    if (next[group.id].length > 0) {
      params.set(
        group.id,
        next[group.id].map((value) => encodeURIComponent(value)).join(","),
      );
    }
  }
  return params;
}

export function hasActiveFilters(active: ActiveFilters): boolean {
  return FILTER_GROUPS.some((group) => active[group.id].length > 0);
}

export function clearActiveFilters(): ActiveFilters {
  return emptyActiveFilters();
}
