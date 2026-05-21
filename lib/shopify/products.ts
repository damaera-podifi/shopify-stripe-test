import type { AdminMemberPricing } from "./admin-member-pricing";
import { applyPercentToMoney } from "./member-pricing";
import { injectBuyerInContext } from "./in-context";
import { storefrontQuery } from "./storefront";

export type StoreProductImage = {
  url: string;
  altText: string | null;
};

export type StoreProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: {
    amount: string;
    currencyCode: string;
  };
  compareAtPrice?: {
    amount: string;
    currencyCode: string;
  };
};

export type StoreProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  vendor: string;
  featuredImage: StoreProductImage | null;
  images: StoreProductImage[];
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  /** Public list price when member pricing applies */
  compareAtPriceRange?: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: StoreProductVariant[];
};

export const PRODUCT_TYPE_FILTERS = [
  { label: "All", value: null },
  { label: "Test Kits", value: "Test Kit" },
  { label: "Peptides", value: "Peptide" },
  { label: "Supplements", value: "Supplement" },
  { label: "Bundles", value: "Bundle" },
] as const;

const PRODUCT_CARD_FIELDS = `
  id
  title
  handle
  description
  productType
  tags
  vendor
  featuredImage {
    url
    altText
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  variants(first: 1) {
    edges {
      node {
        id
        availableForSale
      }
    }
  }
`;

const PRODUCT_DETAIL_FIELDS = `
  id
  title
  handle
  description
  descriptionHtml
  productType
  tags
  vendor
  featuredImage {
    url
    altText
  }
  images(first: 8) {
    edges {
      node {
        url
        altText
      }
    }
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  variants(first: 20) {
    edges {
      node {
        id
        title
        availableForSale
        price {
          amount
          currencyCode
        }
      }
    }
  }
`;

type ProductListNode = Omit<
  StoreProduct,
  "descriptionHtml" | "images" | "variants"
> & {
  variants: { edges: Array<{ node: { id: string; availableForSale: boolean } }> };
};

type ProductsQueryResult = {
  shop: {
    name: string;
    primaryDomain: { url: string };
  };
  products: {
    edges: Array<{ node: ProductListNode }>;
  };
};

type ProductQueryResult = {
  product: {
    id: string;
    title: string;
    handle: string;
    description: string;
    descriptionHtml: string;
    productType: string;
    tags: string[];
    vendor: string;
    featuredImage: StoreProductImage | null;
    images: { edges: Array<{ node: StoreProductImage }> };
    priceRange: StoreProduct["priceRange"];
    variants: { edges: Array<{ node: StoreProductVariant }> };
  } | null;
};

const PRODUCTS_QUERY = `#graphql
  query StoreProducts($first: Int!, $query: String) {
    shop {
      name
      primaryDomain {
        url
      }
    }
    products(first: $first, query: $query) {
      edges {
        node {
          ${PRODUCT_CARD_FIELDS}
        }
      }
    }
  }
`;

function productTypeSearchQuery(productType: string | null) {
  if (!productType) return null;
  return `product_type:'${productType.replace(/'/g, "\\'")}'`;
}

function normalizeProductDetail(
  node: ProductQueryResult["product"],
): StoreProduct | null {
  if (!node) return null;

  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: node.description,
    descriptionHtml: node.descriptionHtml,
    productType: node.productType,
    tags: node.tags,
    vendor: node.vendor,
    featuredImage: node.featuredImage,
    images: node.images.edges.map((edge) => edge.node),
    priceRange: node.priceRange,
    variants: node.variants.edges.map((edge) => edge.node),
  };
}

function applyAdminMemberDiscountToProducts(
  products: ReturnType<typeof mapListProducts>,
  pricing: AdminMemberPricing,
) {
  if (!pricing.isMember || pricing.discountPercent === null) {
    return products;
  }

  const percent = pricing.discountPercent;

  return products.map((product) => {
    const memberMin = applyPercentToMoney(
      product.priceRange.minVariantPrice,
      percent,
    );
    const publicMin = product.priceRange.minVariantPrice;
    const hasDiscount = Number(memberMin.amount) < Number(publicMin.amount);

    if (!hasDiscount) return product;

    return {
      ...product,
      priceRange: { minVariantPrice: memberMin },
      compareAtPriceRange: { minVariantPrice: publicMin },
      variants: product.variants.map((variant) => {
        const memberPrice = applyPercentToMoney(variant.price, percent);
        return {
          ...variant,
          price: memberPrice,
          compareAtPrice: variant.price,
        };
      }),
    };
  });
}

function mapListProducts(data: ProductsQueryResult) {
  return data.products.edges.map((edge) => {
    const variant = edge.node.variants.edges[0]?.node;
    const price = edge.node.priceRange.minVariantPrice;

    return {
      ...edge.node,
      descriptionHtml: "",
      images: edge.node.featuredImage ? [edge.node.featuredImage] : [],
      variants: variant
        ? [
            {
              id: variant.id,
              title: "Default Title",
              availableForSale: variant.availableForSale,
              price,
            },
          ]
        : [],
    };
  });
}

async function fetchStoreProductsQuery(
  first: number,
  productType: string | null,
  customerAccessToken?: string,
) {
  const variables = {
    first,
    query: productTypeSearchQuery(productType),
  };

  if (!customerAccessToken) {
    return storefrontQuery<ProductsQueryResult>(PRODUCTS_QUERY, variables);
  }

  const contextualQuery = injectBuyerInContext(
    PRODUCTS_QUERY,
    customerAccessToken,
  );
  return storefrontQuery<ProductsQueryResult>(contextualQuery, variables, {
    revalidate: false,
  });
}

export async function getStoreProducts(options?: {
  first?: number;
  productType?: string | null;
  customerAccessToken?: string | null;
  adminMemberPricing?: AdminMemberPricing | null;
}) {
  const first = options?.first ?? 50;
  const productType = options?.productType ?? null;
  const token = options?.customerAccessToken ?? null;
  const adminPricing = options?.adminMemberPricing ?? null;

  const publicData = await fetchStoreProductsQuery(first, productType);
  const publicProducts = mapListProducts(publicData);

  if (!token) {
    const adminProducts =
      adminPricing?.isMember && adminPricing.discountPercent !== null
        ? applyAdminMemberDiscountToProducts(publicProducts, adminPricing)
        : publicProducts;

    return {
      shopName: publicData.shop.name,
      shopUrl: publicData.shop.primaryDomain.url,
      products: adminProducts,
      activeProductType: productType,
      hasMemberPricing: Boolean(adminPricing?.isMember),
      pricingSource: adminPricing?.isMember ? ("admin" as const) : null,
    };
  }

  const memberData = await fetchStoreProductsQuery(first, productType, token);
  const memberById = new Map(
    mapListProducts(memberData).map((p) => [p.id, p] as const),
  );

  const products = publicProducts.map((product) => {
    const member = memberById.get(product.id);
    if (!member) return product;

    const publicAmount = Number(product.priceRange.minVariantPrice.amount);
    const memberAmount = Number(member.priceRange.minVariantPrice.amount);
    const hasDiscount =
      Number.isFinite(publicAmount) &&
      Number.isFinite(memberAmount) &&
      memberAmount < publicAmount;

    if (!hasDiscount) {
      return { ...member };
    }

    return {
      ...member,
      compareAtPriceRange: product.priceRange,
      variants: member.variants.map((v, i) => {
        const publicVariant = product.variants[i];
        if (!publicVariant) return v;
        const pub = Number(publicVariant.price.amount);
        const mem = Number(v.price.amount);
        if (Number.isFinite(pub) && Number.isFinite(mem) && mem < pub) {
          return {
            ...v,
            compareAtPrice: publicVariant.price,
          };
        }
        return v;
      }),
    };
  });

  return {
    shopName: publicData.shop.name,
    shopUrl: publicData.shop.primaryDomain.url,
    products,
    activeProductType: productType,
    hasMemberPricing: true,
    pricingSource: "storefront" as const,
  };
}

export async function getProductByHandle(
  handle: string,
  options?: {
    customerAccessToken?: string | null;
    adminMemberPricing?: AdminMemberPricing | null;
  },
) {
  const query = `#graphql
    query StoreProduct($handle: String!) {
      product(handle: $handle) {
        ${PRODUCT_DETAIL_FIELDS}
      }
    }
  `;

  const token = options?.customerAccessToken ?? null;
  const adminPricing = options?.adminMemberPricing ?? null;
  const publicData = await storefrontQuery<ProductQueryResult>(query, {
    handle,
  });
  const publicProduct = normalizeProductDetail(publicData.product);
  if (!publicProduct) return null;

  if (!token && adminPricing?.isMember && adminPricing.discountPercent !== null) {
    const variants = publicProduct.variants.map((variant) => {
      const memberPrice = applyPercentToMoney(
        variant.price,
        adminPricing.discountPercent!,
      );
      return {
        ...variant,
        price: memberPrice,
        compareAtPrice: variant.price,
      };
    });
    const memberMin = applyPercentToMoney(
      publicProduct.priceRange.minVariantPrice,
      adminPricing.discountPercent,
    );
    return {
      ...publicProduct,
      priceRange: { minVariantPrice: memberMin },
      compareAtPriceRange: publicProduct.priceRange,
      variants,
    };
  }

  if (!token) return publicProduct;

  const memberQuery = injectBuyerInContext(query, token);
  const memberData = await storefrontQuery<ProductQueryResult>(memberQuery, {
    handle,
  }, { revalidate: false });
  const memberProduct = normalizeProductDetail(memberData.product);
  if (!memberProduct) return publicProduct;

  const variants = memberProduct.variants.map((variant, index) => {
    const publicVariant = publicProduct.variants[index];
    if (!publicVariant) return variant;
    const pub = Number(publicVariant.price.amount);
    const mem = Number(variant.price.amount);
    if (Number.isFinite(pub) && Number.isFinite(mem) && mem < pub) {
      return { ...variant, compareAtPrice: publicVariant.price };
    }
    return variant;
  });

  const publicMin = Number(publicProduct.priceRange.minVariantPrice.amount);
  const memberMin = Number(memberProduct.priceRange.minVariantPrice.amount);
  const compareAtPriceRange =
    Number.isFinite(publicMin) &&
    Number.isFinite(memberMin) &&
    memberMin < publicMin
      ? publicProduct.priceRange
      : undefined;

  return {
    ...memberProduct,
    compareAtPriceRange,
    variants,
  };
}

export { formatPrice } from "./format-price";

export function productTypeToFilterParam(productType: string | null) {
  if (!productType) return undefined;
  return encodeURIComponent(productType);
}

export function filterParamToProductType(param: string | undefined) {
  if (!param) return null;
  const decoded = decodeURIComponent(param);
  const match = PRODUCT_TYPE_FILTERS.find((f) => f.value === decoded);
  return match?.value ?? null;
}
