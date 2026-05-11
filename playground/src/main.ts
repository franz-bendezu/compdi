import "./styles.css";

import {
  defineAppTeardown,
  defineAsyncSingleton,
  defineLazySingleton,
  defineSingleton,
  defineTransient
} from "@compdi/core";

class Database {
  private static nextId = 1;

  public readonly id = Database.nextId++;
  public connected = true;

  public query(sql: string): string {
    return this.connected
      ? `db#${this.id}: ${sql}`
      : `db#${this.id}: disconnected`;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.connected = false;
  }
}

class Logger {
  private static nextId = 1;

  public readonly id = Logger.nextId++;

  public info(message: string): string {
    return `logger#${this.id}: ${message}`;
  }
}

class Service {
  private static nextId = 1;

  public readonly id = Service.nextId++;

  constructor(
    private readonly db: Database,
    private readonly logger: Logger
  ) {}

  run(): string {
    return this.logger.info(`service#${this.id} -> ${this.db.query("SELECT 1")}`);
  }
}

class Analytics {
  public static instances = 0;

  public readonly id: number;

  constructor(private readonly db: Database) {
    this.id = ++Analytics.instances;
  }

  ping(): string {
    return `analytics#${this.id} -> ${this.db.query("SELECT analytics")}`;
  }
}

class AsyncConnection {
  private static nextId = 1;

  public readonly id = AsyncConnection.nextId++;
  public online = true;

  public request(resource: string): string {
    if (!this.online) {
      throw new Error(`connection#${this.id} is offline`);
    }

    return `connection#${this.id} -> GET ${resource}`;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.online = false;
  }
}

export const db = defineSingleton(Database, []);
export const logger = defineSingleton(Logger, []);
export const createService = defineTransient(Service, [db, logger]);
export const analytics = defineLazySingleton(Analytics, [db]);

export const connection = defineAsyncSingleton(async () => {
  return new AsyncConnection();
}, []);

export const teardown = defineAppTeardown([db, connection]);

type DemoState = {
  lastServiceRun: string;
  serviceCount: number;
  lastAnalyticsRun: string;
  lastConnectionRun: string;
  teardownCount: number;
  teardownStatus: string;
};

const state: DemoState = {
  lastServiceRun: "Click \"Create transient service\" to instantiate one.",
  serviceCount: 0,
  lastAnalyticsRun: "Lazy singleton has not been touched yet.",
  lastConnectionRun: "Async singleton resolved during module evaluation.",
  teardownCount: 0,
  teardownStatus: "Resources are active."
};

type AppElements = {
  snapshotDb: HTMLSpanElement;
  snapshotConnection: HTMLSpanElement;
  snapshotAnalyticsCount: HTMLSpanElement;
  snapshotTeardownCount: HTMLSpanElement;
  cardDb: HTMLElement;
  cardConnection: HTMLElement;
  cardAnalytics: HTMLElement;
  statusDb: HTMLElement;
  statusLogger: HTMLElement;
  statusConnection: HTMLElement;
  statusAnalytics: HTMLElement;
  eventService: HTMLElement;
  eventServiceCount: HTMLSpanElement;
  eventAnalytics: HTMLElement;
  eventAnalyticsCount: HTMLSpanElement;
  eventConnection: HTMLElement;
  eventTeardownStatus: HTMLElement;
  summaryDb: HTMLElement;
  summaryLogger: HTMLElement;
  summaryConnection: HTMLElement;
  actionService: HTMLButtonElement;
  actionAnalytics: HTMLButtonElement;
  actionConnection: HTMLButtonElement;
  actionTeardown: HTMLButtonElement;
};

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function initializeApp(): AppElements {

  return {
    snapshotDb: getRequiredElement<HTMLSpanElement>("#snapshot-db"),
    snapshotConnection: getRequiredElement<HTMLSpanElement>("#snapshot-connection"),
    snapshotAnalyticsCount: getRequiredElement<HTMLSpanElement>("#snapshot-analytics-count"),
    snapshotTeardownCount: getRequiredElement<HTMLSpanElement>("#snapshot-teardown-count"),
    cardDb: getRequiredElement<HTMLElement>("#card-db"),
    cardConnection: getRequiredElement<HTMLElement>("#card-connection"),
    cardAnalytics: getRequiredElement<HTMLElement>("#card-analytics"),
    statusDb: getRequiredElement<HTMLElement>("#status-db"),
    statusLogger: getRequiredElement<HTMLElement>("#status-logger"),
    statusConnection: getRequiredElement<HTMLElement>("#status-connection"),
    statusAnalytics: getRequiredElement<HTMLElement>("#status-analytics"),
    eventService: getRequiredElement<HTMLElement>("#event-service"),
    eventServiceCount: getRequiredElement<HTMLSpanElement>("#event-service-count"),
    eventAnalytics: getRequiredElement<HTMLElement>("#event-analytics"),
    eventAnalyticsCount: getRequiredElement<HTMLSpanElement>("#event-analytics-count"),
    eventConnection: getRequiredElement<HTMLElement>("#event-connection"),
    eventTeardownStatus: getRequiredElement<HTMLElement>("#event-teardown-status"),
    summaryDb: getRequiredElement<HTMLElement>("#summary-db"),
    summaryLogger: getRequiredElement<HTMLElement>("#summary-logger"),
    summaryConnection: getRequiredElement<HTMLElement>("#summary-connection"),
    actionService: getRequiredElement<HTMLButtonElement>("#action-service"),
    actionAnalytics: getRequiredElement<HTMLButtonElement>("#action-analytics"),
    actionConnection: getRequiredElement<HTMLButtonElement>("#action-connection"),
    actionTeardown: getRequiredElement<HTMLButtonElement>("#action-teardown")
  };
}

function updateView(elements: AppElements): void {
  elements.snapshotDb.textContent = db.connected ? "connected" : "disposed";
  elements.snapshotConnection.textContent = connection.online ? "ready" : "offline";
  elements.snapshotAnalyticsCount.textContent = String(Analytics.instances);
  elements.snapshotTeardownCount.textContent = String(state.teardownCount);

  elements.cardDb.className = `card ${db.connected ? "good" : "warn"}`;
  elements.cardConnection.className = `card ${connection.online ? "good" : "warn"}`;
  elements.cardAnalytics.className = `card ${Analytics.instances === 0 ? "neutral" : "good"}`;

  elements.statusDb.textContent = `db#${db.id} • ${db.connected ? "alive" : "disposed"}`;
  elements.statusLogger.textContent = `logger#${logger.id} • shared`;
  elements.statusConnection.textContent = `connection#${connection.id} • ${connection.online ? "online" : "offline"}`;
  elements.statusAnalytics.textContent =
    Analytics.instances === 0 ? "not created" : `analytics#1 • materialized`;

  elements.eventService.textContent = state.lastServiceRun;
  elements.eventServiceCount.textContent = String(state.serviceCount);
  elements.eventAnalytics.textContent = state.lastAnalyticsRun;
  elements.eventAnalyticsCount.textContent = String(Analytics.instances);
  elements.eventConnection.textContent = state.lastConnectionRun;
  elements.eventTeardownStatus.textContent = state.teardownStatus;

  elements.summaryDb.textContent = `db#${db.id}`;
  elements.summaryLogger.textContent = `logger#${logger.id}`;
  elements.summaryConnection.textContent = `connection#${connection.id}`;
}

const elements = initializeApp();

elements.actionService.addEventListener("click", () => {
    const service = createService();
    state.serviceCount += 1;
    state.lastServiceRun = service.run();
    updateView(elements);
  });

elements.actionAnalytics.addEventListener("click", () => {
    state.lastAnalyticsRun = analytics.ping();
    updateView(elements);
  });

elements.actionConnection.addEventListener("click", () => {
    try {
      state.lastConnectionRun = connection.request("/health");
    } catch (error) {
      state.lastConnectionRun = error instanceof Error ? error.message : String(error);
    }
    updateView(elements);
  });

elements.actionTeardown.addEventListener("click", async () => {
    await teardown();
    state.teardownCount += 1;
    state.teardownStatus = "Teardown completed. Singleton resources are now disposed.";
    updateView(elements);
  });

updateView(elements);
