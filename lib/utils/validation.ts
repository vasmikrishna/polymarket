export function validateMarketSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }
  
  // Basic validation: slug should be lowercase, alphanumeric with hyphens
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length > 0 && slug.length <= 200;
}

export function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Basic Ethereum address validation (0x followed by 40 hex characters)
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address);
}

export function validatePrice(price: string | number): boolean {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return !isNaN(numPrice) && numPrice > 0 && numPrice <= 1;
}

export function validateSize(size: string | number, minSize: number = 5): boolean {
  const numSize = typeof size === 'string' ? parseFloat(size) : size;
  return !isNaN(numSize) && numSize >= minSize;
}

