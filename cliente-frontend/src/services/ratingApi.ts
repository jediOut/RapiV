import apiClient from './apiClient';
import type { CreateRatingPayload, Rating, RatingSummary, RatingTargetType, UpdateRatingPayload } from '@rapidin/contracts';

export const ratingApi = {
  async createRating(payload: CreateRatingPayload): Promise<Rating> {
    return apiClient.post<Rating>('/ratings', payload);
  },

  async updateRating(ratingId: string, payload: UpdateRatingPayload): Promise<Rating> {
    return apiClient.patch<Rating>(`/ratings/${ratingId}`, payload);
  },

  async getMyOrderRatings(orderGroupId: string): Promise<Rating[]> {
    return apiClient.get<Rating[]>(`/ratings/mine/orders/${orderGroupId}`);
  },

  async getMyRatings(): Promise<Rating[]> {
    return apiClient.get<Rating[]>('/ratings/mine');
  },

  async getTargetRatings(targetType: RatingTargetType, targetId: string): Promise<Rating[]> {
    return apiClient.get<Rating[]>(`/ratings/targets/${targetType}/${targetId}`);
  },

  async getTargetSummary(targetType: RatingTargetType, targetId: string): Promise<RatingSummary> {
    return apiClient.get<RatingSummary>(`/ratings/summary?targetType=${targetType}&targetId=${targetId}`);
  },
};
