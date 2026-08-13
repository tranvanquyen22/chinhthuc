// Helper module for generating and reading dedicated direct access URLs for individual shops

export const generateShopSlug = (shopNameOrEmail) => {
  if (!shopNameOrEmail) return 'shop-tqstore';
  const cleanStr = shopNameOrEmail.split('@')[0];
  const clean = cleanStr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'shop-tqstore';
};

export const getShopDirectLink = (shopSlug) => {
  const origin = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'http://localhost:5173';
  return `${origin}/?shop=${encodeURIComponent(shopSlug)}`;
};
