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

export async function getStoreProducts(options?: {
  first?: number;
  productType?: string | null;
}) {
  const first = options?.first ?? 50;
  const productType = options?.productType ?? null;

  const data = await storefrontQuery<ProductsQueryResult>(PRODUCTS_QUERY, {
    first,
    query: productTypeSearchQuery(productType),
  });

  return {
    shopName: data.shop.name,
    shopUrl: data.shop.primaryDomain.url,
    products: data.products.edges.map((edge) => {
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
    }),
    activeProductType: productType,
  };
}

export async function getProductByHandle(handle: string) {
  const query = `#graphql
    query StoreProduct($handle: String!) {
      product(handle: $handle) {
        ${PRODUCT_DETAIL_FIELDS}
      }
    }
  `;

  const data = await storefrontQuery<ProductQueryResult>(query, { handle });
  return normalizeProductDetail(data.product);
}

export function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(amount));
}

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
