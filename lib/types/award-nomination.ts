export type AwardNominationDetail = {
  name: string;
  total: number;
  byGroup: Partial<Record<string, number>>;
};

export type AwardCommentRow = {
  recommenderName: string;
  comment: string;
};

export type AwardWinnerDetail = {
  key: string;
  name: string;
  total: number;
  recommenders: AwardCommentRow[];
};

export type AwardGroupSummary = {
  group: string;
  label: string;
  winners: AwardWinnerDetail[];
};
