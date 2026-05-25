import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ips = Array.isArray(req.ips) ? (req.ips as string[]) : [];
    const fallback = typeof req.ip === "string" ? req.ip : "";
    const tracker = ips.length > 0 ? ips[0] : fallback;
    return Promise.resolve(tracker);
  }
}
