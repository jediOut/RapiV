export type RatingTargetType = "BUSINESS" | "COURIER";

export type Rating = {
  id: string;
  orderGroupId: string;
  customerId: string;
  targetType: RatingTargetType;
  targetId: string;
  score: number;
  comment?: string | null;
  editCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type RatingSummary = {
  average: number | null;
  count: number;
};

export type CreateRatingPayload = {
  orderGroupId: string;
  targetType: RatingTargetType;
  targetId: string;
  score: number;
  comment?: string;
};

export type UpdateRatingPayload = {
  score: number;
  comment?: string;
};
