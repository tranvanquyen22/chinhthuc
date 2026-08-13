// Helper module for managing featured products & shops pinned by Super Admin for Homepage & Search Suggestions

import { supabase } from './supabase';

const FEATURED_PROMOTIONS_KEY = 'tq_featured_promotions';

const DEFAULT_FEATURED = {
  productIds: [1, 2, 3], // Default sample featured product IDs
  shopEmails: ['retail@tqstore.vn', 'fnb@tqstore.vn'], // Default sample featured shop emails
  updated_at: new Date().toISOString()
};

export const getFeaturedPromotions = () => {
  try {
    const saved = localStorage.getItem(FEATURED_PROMOTIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        productIds: Array.isArray(parsed.productIds) ? parsed.productIds : DEFAULT_FEATURED.productIds,
        shopEmails: Array.isArray(parsed.shopEmails) ? parsed.shopEmails : DEFAULT_FEATURED.shopEmails,
        updated_at: parsed.updated_at || DEFAULT_FEATURED.updated_at
      };
    }
  } catch (e) {
    console.error('getFeaturedPromotions error:', e);
  }
  return DEFAULT_FEATURED;
};

export const fetchCloudFeaturedPromotions = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_platform_config')
      .select('featured_promotions')
      .limit(1)
      .single();

    if (!error && data?.featured_promotions) {
      const parsed = data.featured_promotions;
      const configObj = {
        productIds: Array.isArray(parsed.productIds) ? parsed.productIds : DEFAULT_FEATURED.productIds,
        shopEmails: Array.isArray(parsed.shopEmails) ? parsed.shopEmails : DEFAULT_FEATURED.shopEmails,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(FEATURED_PROMOTIONS_KEY, JSON.stringify(configObj));
      return configObj;
    }
  } catch (err) {
    console.warn('Supabase Cloud Featured Promotions Notice:', err?.message);
  }
  return getFeaturedPromotions();
};

export const saveFeaturedPromotions = async (featuredObj) => {
  const payload = {
    productIds: featuredObj.productIds || [],
    shopEmails: featuredObj.shopEmails || [],
    updated_at: new Date().toISOString()
  };

  localStorage.setItem(FEATURED_PROMOTIONS_KEY, JSON.stringify(payload));

  try {
    await supabase
      .from('tq_platform_config')
      .upsert({ id: 1, featured_promotions: payload, updated_at: new Date().toISOString() });
  } catch (err) {
    console.warn('Cloud Featured Promotions save notice:', err?.message);
  }

  return payload;
};
