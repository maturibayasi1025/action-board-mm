export type AwardNominationDetail = {
  name: string;
  total: number;
  byGroup: Partial<Record<string, number>>;
};
