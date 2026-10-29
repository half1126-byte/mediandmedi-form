type MarketingDirection = {
  marketingGoals?: string[];
  marketingGoalsOther?: string;
  desiredChannels?: string[];
  desiredChannelsOther?: string;
};

export function marketingDirectionComplete(data?: MarketingDirection): boolean {
  const answered = (values: unknown, other: unknown, max = Infinity) =>
    Array.isArray(values) && values.length > 0 && values.length <= max
    && values.every((value) => typeof value === 'string' && !!value.trim())
    && (!values.includes('기타') || (typeof other === 'string' && !!other.trim()));
  return answered(data?.marketingGoals, data?.marketingGoalsOther, 3)
    && answered(data?.desiredChannels, data?.desiredChannelsOther);
}

export function didInfoComplete(data?: { didInfo?: string }): boolean {
  return typeof data?.didInfo === 'string' && !!data.didInfo.trim();
}
