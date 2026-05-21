const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,

  // Businesses
  BUSINESSES: `${API_BASE_URL}/businesses`,
  BUSINESS_DETAIL: (id: string) => `${API_BASE_URL}/businesses/${id}`,
  BUSINESS_PRODUCTS: (id: string) => `${API_BASE_URL}/businesses/${id}/products`,

  // Products
  PRODUCTS: `${API_BASE_URL}/products`,

  // Orders
  ORDERS: `${API_BASE_URL}/orders`,
  ORDER_DETAIL: (id: string) => `${API_BASE_URL}/orders/${id}`,
  CREATE_ORDER: `${API_BASE_URL}/orders`,
};

export default API_BASE_URL;
