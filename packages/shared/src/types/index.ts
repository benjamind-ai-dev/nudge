export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface HealthCheck {
  status: "ok";
  version: string;
}
