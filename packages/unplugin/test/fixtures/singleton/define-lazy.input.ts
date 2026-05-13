// Style: plain classes, explicit generics only on lazy defines
import { createSingleton, defineSingleton } from "@compdi/core";

class Config {
  constructor(readonly env: string) {}
}

class Logger {
  constructor(readonly config: Config) {}
  log(msg: string) { console.log(msg); }
}

class HeavyAnalytics {
  constructor(readonly logger: Logger) {}
  track(event: string) { this.logger.log(event); }
}

class MetricsCollector {
  constructor(readonly analytics: HeavyAnalytics) {}
  record(metric: string, value: number) { this.analytics.track(`${metric}:${value}`); }
}

export const config = createSingleton({ target: Config, deps: ["production"] });
export const logger = createSingleton({ target: Logger, deps: [config] });
export const useAnalytics = defineSingleton<HeavyAnalytics>({ target: HeavyAnalytics, deps: [logger], lazy: true });
export const useMetrics = defineSingleton<MetricsCollector>({ target: MetricsCollector, deps: [useAnalytics], lazy: true });
