import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import { Business, Product } from '../types/business';

export const businessApi = {
  async getBusinesses(): Promise<Business[]> {
    return apiClient.get<Business[]>(API_ENDPOINTS.BUSINESSES);
  },

  async getBusinessDetail(id: string): Promise<Business> {
    return apiClient.get<Business>(API_ENDPOINTS.BUSINESS_DETAIL(id));
  },

  async getBusinessProducts(businessId: string): Promise<Product[]> {
    return apiClient.get<Product[]>(
      API_ENDPOINTS.BUSINESS_PRODUCTS(businessId)
    );
  },

  async getProducts(): Promise<Product[]> {
    return apiClient.get<Product[]>(API_ENDPOINTS.PRODUCTS);
  },
};
