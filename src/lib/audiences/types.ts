export type Audience = {
  id: string;
  restaurantId: string;
  slug: string;
  name: string;
  minDays: number;
  maxDays: number;
  isDefault: boolean;
  createdAt: string;
};

export type AudienceWithCount = Audience & {
  total: number;
  optedIn: number;
};
