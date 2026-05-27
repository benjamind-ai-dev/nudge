export interface Outstanding {
  totalCents: number;
  count: number;
}

export interface BucketTotal {
  totalCents: number;
  count: number;
}

export interface AgingBuckets {
  current: BucketTotal;
  days1to30: BucketTotal;
  days31to60: BucketTotal;
  days61to90: BucketTotal;
  days90plus: BucketTotal;
}

export interface DashboardSummary {
  outstanding: Outstanding;
  recoveredThisMonth: {
    totalCents: number;
    pctChangeVsLastMonth: number;
  };
  avgDaysToPay: {
    currentDays: number;
    previousDays: number;
  };
  activeSequences: {
    count: number;
  };
  aging: AgingBuckets;
}
