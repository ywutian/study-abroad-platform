import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  categorizeError,
  RedisErrorKind,
  RedisMetricsCollector,
  RedisOpKind,
} from './redis-metrics.service';

type RedisClient = Redis;

interface RedisEndpointSpec {
  label: string;
  url?: string;
  host?: string;
  port?: number;
  password?: string;
}

export interface RedisEndpointState {
  /** Display label, e.g. `url:1` or `redis-1.upstash.io:6379`. */
  label: string;
  /** Whether the endpoint is currently the one carrying traffic. */
  active: boolean;
  /** Whether this endpoint's circuit is open (it's NOT being tried). */
  circuitOpen: boolean;
  circuitOpenUntil: string | null;
  circuitReason: RedisErrorKind | null;
  circuitMessage: string | null;
}

export interface RedisRuntimeState {
  configured: boolean;
  connected: boolean;
  activeEndpoint: string | null;
  circuitOpen: boolean;
  circuitOpenUntil: string | null;
  circuitReason: RedisErrorKind | null;
  circuitMessage: string | null;
  endpointCount: number;
  availableEndpointCount: number;
  /** Per-endpoint detail so operators can see which Redis is in use. */
  endpoints: RedisEndpointState[];
  lastErrorAt: string | null;
  lastErrorKind: RedisErrorKind | null;
  lastErrorMessage: string | null;
  lastConnectedAt: string | null;
  lastReconnectAttemptAt: string | null;
  nextReconnectAt: string | null;
  reconnectAttempts: number;
}

interface EndpointCircuit {
  openUntil: number;
  reason: RedisErrorKind;
  message: string;
}

export interface HealthResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  message?: string;
}

const DEFAULT_COMMAND_TIMEOUT_MS = 1000;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 60 * 60 * 1000;
const DEFAULT_TRANSIENT_CIRCUIT_COOLDOWN_MS = 30 * 1000;
const DEFAULT_HEALTH_PING_INTERVAL_MS = 60 * 1000;
const DEFAULT_RECONNECT_INTERVAL_MS = 30 * 1000;
const DEFAULT_DRIVER_RETRY_MAX_DELAY_MS = 5 * 1000;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient | null = null;
  private isConnected = false;
  private endpointSpecs: RedisEndpointSpec[] = [];
  private activeEndpointIndex = -1;
  private readonly endpointCircuits = new Map<string, EndpointCircuit>();
  private lastErrorAt: number | null = null;
  private lastErrorKind: RedisErrorKind | null = null;
  private lastErrorMessage: string | null = null;
  private lastHealthCheckAt = 0;
  private lastHealthResult: HealthResult | null = null;
  private lastConnectedAt: number | null = null;
  private lastReconnectAttemptAt: number | null = null;
  private nextReconnectAt: number | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectInFlight = false;
  private isShuttingDown = false;

  constructor(
    private configService: ConfigService,
    private readonly metrics: RedisMetricsCollector,
  ) {}

  async onModuleInit() {
    this.endpointSpecs = this.loadEndpointSpecs();
    this.endpointCircuits.clear();
    await this.connect();
    this.scheduleReconnectIfNeeded();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.clearReconnectTimer();
    await this.disconnect();
  }

  private loadEndpointSpecs(): RedisEndpointSpec[] {
    const redisUrls = this.parseUrlList(
      this.configService.get<string>('REDIS_CACHE_URLS') ??
        this.configService.get<string>('REDIS_STATE_URLS') ??
        this.configService.get<string>('REDIS_URLS') ??
        this.configService.get<string>('REDIS_URL'),
    );

    if (redisUrls.length > 0) {
      return redisUrls.map((url, index) => ({
        label: `url:${index + 1}`,
        url,
      }));
    }

    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (!redisHost) {
      return [];
    }

    return [
      {
        label: `${redisHost}:${redisPort ?? 6379}`,
        host: redisHost,
        port: redisPort ?? 6379,
        password: redisPassword || undefined,
      },
    ];
  }

  private parseUrlList(raw?: string | null): string[] {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0);
        }
      } catch {
        this.logger.warn(
          'REDIS URL list is not valid JSON; falling back to CSV parsing',
        );
      }
    }

    return trimmed
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private async connect(startIndex = 0) {
    this.clearReconnectTimer();
    await this.disconnect(false);

    if (this.endpointSpecs.length === 0) {
      this.isConnected = false;
      this.client = null;
      this.logger.warn(
        'Redis not configured, running without Redis-backed cache',
      );
      return;
    }

    const commandTimeoutMs = this.getCommandTimeoutMs();
    const attempts = this.endpointSpecs.length;

    for (let offset = 0; offset < attempts; offset++) {
      const index = (startIndex + offset) % this.endpointSpecs.length;
      const spec = this.endpointSpecs[index];
      if (this.isEndpointCircuitOpen(spec)) {
        continue;
      }

      try {
        const client = this.createClient(spec, commandTimeoutMs);
        this.attachEventHandlers(client, spec);
        this.client = client;
        this.activeEndpointIndex = index;

        await client.connect();
        const start = Date.now();
        await client.ping();
        this.metrics.record({
          op: 'admin',
          key: `PING:${spec.label}`,
          latencyMs: Date.now() - start,
        });

        this.isConnected = true;
        this.lastConnectedAt = Date.now();
        this.reconnectAttempts = 0;
        this.lastHealthCheckAt = 0;
        this.lastHealthResult = null;
        this.logger.log(`Redis connected (${spec.label})`);
        return;
      } catch (error) {
        this.rememberError(error);
        this.metrics.record({
          op: 'admin',
          key: `CONNECT:${spec.label}`,
          latencyMs: commandTimeoutMs,
          error,
        });
        this.destroyClientQuietly();
        const { kind, message } = categorizeError(error);
        this.logger.warn(`Redis connect failed (${spec.label}): ${message}`);
        if (this.shouldOpenCircuit(kind)) {
          await this.openCircuit(kind, message, spec);
        }
      }
    }

    this.client = null;
    this.activeEndpointIndex = -1;
    this.isConnected = false;
  }

  private createClient(
    spec: RedisEndpointSpec,
    commandTimeoutMs: number,
  ): RedisClient {
    const options = {
      lazyConnect: true,
      commandTimeout: commandTimeoutMs,
      connectTimeout: commandTimeoutMs,
      enableOfflineQueue: this.getBooleanConfig(
        'REDIS_ENABLE_OFFLINE_QUEUE',
        false,
      ),
      maxRetriesPerRequest: this.getNumberConfig(
        'REDIS_MAX_RETRIES_PER_REQUEST',
        1,
      ),
      retryStrategy: (times: number) => {
        if (this.isEndpointCircuitOpen(spec)) {
          this.logger.warn(`Redis retry stopped (${spec.label})`);
          return null;
        }
        if (times > 5) {
          this.logger.warn(
            `Redis driver retry budget exhausted (${spec.label}); background reconnect loop will continue`,
          );
          return null;
        }
        return Math.min(times * 500, DEFAULT_DRIVER_RETRY_MAX_DELAY_MS);
      },
      reconnectOnError: (error: Error) => {
        const { kind, message } = categorizeError(error);
        if (this.shouldOpenCircuit(kind)) {
          void this.openCircuit(kind, message, spec);
          return false;
        }
        return false;
      },
    } as const;

    if (spec.url) {
      return new Redis(spec.url, options);
    }

    return new Redis({
      ...options,
      host: spec.host,
      port: spec.port,
      password: spec.password,
    });
  }

  private attachEventHandlers(client: RedisClient, spec: RedisEndpointSpec) {
    client.on('connect', () => {
      if (!this.isEndpointCircuitOpen(spec)) {
        this.isConnected = true;
        this.lastConnectedAt = Date.now();
        this.reconnectAttempts = 0;
      }
    });

    client.on('error', (err: Error) => {
      const { kind, message } = categorizeError(err);
      this.rememberError(err);
      this.logger.warn(`Redis error (${spec.label}): ${message}`);
      if (this.shouldOpenCircuit(kind)) {
        // 2026-05: don't wait for the 60s reconnect timer. If we have other
        // endpoints configured, trigger an immediate failover so quota /
        // auth / connection errors on endpoint N transparently fall over to
        // endpoint N+1.
        void (async () => {
          await this.openCircuit(kind, message, spec);
          await this.tryFailoverFrom(spec);
        })();
      } else {
        this.isConnected = false;
        this.scheduleReconnectIfNeeded();
      }
    });

    client.on('close', () => {
      this.isConnected = false;
      this.logger.log(`Redis disconnected (${spec.label})`);
      this.scheduleReconnectIfNeeded();
    });
  }

  private async disconnect(useQuit = true) {
    if (!this.client) {
      this.isConnected = false;
      return;
    }

    const client = this.client;
    this.client = null;
    this.isConnected = false;
    try {
      if (useQuit) {
        await client.quit();
      } else {
        client.disconnect();
      }
    } catch {
      client.disconnect();
    }
  }

  private destroyClientQuietly() {
    if (!this.client) return;
    try {
      this.client.disconnect();
    } catch {
      // Best-effort cleanup.
    } finally {
      this.client = null;
      this.isConnected = false;
    }
  }

  private getCommandTimeoutMs(): number {
    return this.getNumberConfig(
      'REDIS_COMMAND_TIMEOUT_MS',
      DEFAULT_COMMAND_TIMEOUT_MS,
    );
  }

  private getCircuitCooldownMs(): number {
    return this.getNumberConfig(
      'REDIS_CIRCUIT_BREAKER_COOLDOWN_MS',
      DEFAULT_CIRCUIT_COOLDOWN_MS,
    );
  }

  private getTransientCircuitCooldownMs(): number {
    return this.getNumberConfig(
      'REDIS_TRANSIENT_CIRCUIT_COOLDOWN_MS',
      DEFAULT_TRANSIENT_CIRCUIT_COOLDOWN_MS,
    );
  }

  private getHealthPingIntervalMs(): number {
    return this.getNumberConfig(
      'REDIS_HEALTH_PING_INTERVAL_MS',
      DEFAULT_HEALTH_PING_INTERVAL_MS,
    );
  }

  private getReconnectIntervalMs(): number {
    return this.getNumberConfig(
      'REDIS_RECONNECT_INTERVAL_MS',
      DEFAULT_RECONNECT_INTERVAL_MS,
    );
  }

  private getNumberConfig(key: string, fallback: number): number {
    const value = this.configService.get<number | string>(key);
    const parsed =
      typeof value === 'number' ? value : value ? Number(value) : fallback;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private getBooleanConfig(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string>(key);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return fallback;
  }

  private shouldOpenCircuit(kind: RedisErrorKind): boolean {
    return (
      kind === 'quota_exceeded' ||
      kind === 'auth' ||
      kind === 'timeout' ||
      kind === 'connection'
    );
  }

  private getCircuitCooldownForKind(kind: RedisErrorKind): number {
    return kind === 'timeout' || kind === 'connection'
      ? this.getTransientCircuitCooldownMs()
      : this.getCircuitCooldownMs();
  }

  private async openCircuit(
    kind: RedisErrorKind,
    message: string,
    spec = this.endpointSpecs[this.activeEndpointIndex],
  ) {
    const cooldownMs = this.getCircuitCooldownForKind(kind);
    const openUntil = Date.now() + cooldownMs;
    const circuitMessage = message.slice(0, 500);
    if (spec) {
      this.endpointCircuits.set(spec.label, {
        openUntil,
        reason: kind,
        message: circuitMessage,
      });
    }
    this.isConnected = false;
    await this.disconnect(false);
    this.logger.error(
      `Redis circuit opened for ${spec?.label ?? 'unknown endpoint'} for ${Math.ceil(
        cooldownMs / 1000,
      )}s due to ${kind}: ${circuitMessage}`,
    );
    this.scheduleReconnectIfNeeded();
  }

  private isEndpointCircuitOpen(spec?: RedisEndpointSpec): boolean {
    if (!spec) return false;
    const circuit = this.endpointCircuits.get(spec.label);
    if (!circuit) return false;
    if (circuit.openUntil <= Date.now()) {
      this.endpointCircuits.delete(spec.label);
      return false;
    }
    return true;
  }

  private availableEndpointCount(): number {
    return this.endpointSpecs.filter(
      (spec) => !this.isEndpointCircuitOpen(spec),
    ).length;
  }

  private allEndpointsCircuitOpen(): boolean {
    return this.endpointSpecs.length > 0 && this.availableEndpointCount() === 0;
  }

  private nextCircuitRetryAt(): number | null {
    const openUntilValues = Array.from(this.endpointCircuits.values())
      .map((circuit) => circuit.openUntil)
      .filter((openUntil) => openUntil > Date.now());

    if (openUntilValues.length === 0) return null;
    return Math.min(...openUntilValues);
  }

  private activeCircuit(): EndpointCircuit | null {
    const active = this.endpointSpecs[this.activeEndpointIndex];
    if (!active) return null;
    if (!this.isEndpointCircuitOpen(active)) return null;
    return this.endpointCircuits.get(active.label) ?? null;
  }

  private rememberError(error: unknown) {
    const { kind, message } = categorizeError(error);
    this.lastErrorAt = Date.now();
    this.lastErrorKind = kind;
    this.lastErrorMessage = message.slice(0, 500);
  }

  private async handleOperationError(
    op: RedisOpKind,
    key: string,
    error: unknown,
  ) {
    const { kind, message } = categorizeError(error);
    this.rememberError(error);
    if (this.shouldOpenCircuit(kind)) {
      const failingSpec = this.endpointSpecs[this.activeEndpointIndex];
      await this.openCircuit(kind, message, failingSpec);
      await this.tryFailoverFrom(failingSpec);
    }
    this.logger.warn(`Redis ${op} degraded for ${key}: ${message}`);
  }

  /**
   * Walk forward in `endpointSpecs` past the failing endpoint and try to
   * connect to the next endpoint whose circuit is open. This is the heart of
   * the multi-Redis failover: when one provider exhausts quota or rate-limits,
   * traffic shifts to the next URL in REDIS_URLS without waiting for the
   * background reconnect timer.
   *
   * Safe to call when there's only one endpoint: it will no-op (connect()
   * skips circuit-open endpoints).
   */
  private async tryFailoverFrom(
    failingSpec: RedisEndpointSpec | undefined,
  ): Promise<void> {
    const total = this.endpointSpecs.length;
    if (total === 0) return;

    const failingIndex = failingSpec
      ? this.endpointSpecs.findIndex((s) => s.label === failingSpec.label)
      : this.activeEndpointIndex;
    const startIndex = failingIndex >= 0 ? (failingIndex + 1) % total : 0;

    await this.connect(startIndex);
    this.scheduleReconnectIfNeeded();
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.nextReconnectAt = null;
  }

  private scheduleReconnectIfNeeded() {
    if (
      this.isShuttingDown ||
      this.reconnectTimer ||
      this.reconnectInFlight ||
      this.endpointSpecs.length === 0 ||
      this.connected
    ) {
      return;
    }

    const now = Date.now();
    const circuitRetryAt = this.allEndpointsCircuitOpen()
      ? this.nextCircuitRetryAt()
      : null;
    const delayMs = circuitRetryAt
      ? Math.max(0, circuitRetryAt - now)
      : this.getReconnectIntervalMs();

    this.nextReconnectAt = now + delayMs;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.nextReconnectAt = null;
      void this.runReconnect();
    }, delayMs);
    this.reconnectTimer.unref?.();
  }

  private async runReconnect() {
    if (
      this.isShuttingDown ||
      this.reconnectInFlight ||
      this.endpointSpecs.length === 0 ||
      this.connected
    ) {
      return;
    }

    if (this.allEndpointsCircuitOpen()) {
      this.scheduleReconnectIfNeeded();
      return;
    }

    this.reconnectInFlight = true;
    this.reconnectAttempts += 1;
    this.lastReconnectAttemptAt = Date.now();

    try {
      const startIndex =
        this.activeEndpointIndex >= 0 ? this.activeEndpointIndex : 0;
      await this.connect(startIndex);
    } finally {
      this.reconnectInFlight = false;
      this.scheduleReconnectIfNeeded();
    }
  }

  /**
   * Time + record one Redis operation. Driver errors are re-thrown to the
   * caller; public methods decide the safe fallback for their operation.
   */
  private async record<T>(
    op: RedisOpKind,
    key: string,
    fn: () => Promise<T>,
    hitFromResult?: (value: T) => boolean,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const latencyMs = Date.now() - start;
      this.metrics.record({
        op,
        key,
        latencyMs,
        hit: hitFromResult ? hitFromResult(result) : undefined,
      });
      return result;
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.metrics.record({ op, key, latencyMs, error });
      throw error;
    }
  }

  private async safeRecord<T>(
    op: RedisOpKind,
    key: string,
    fallback: T,
    fn: () => Promise<T>,
    hitFromResult?: (value: T) => boolean,
  ): Promise<T> {
    if (!this.client || !this.connected) {
      if (this.allEndpointsCircuitOpen()) {
        this.metrics.record({
          op,
          key,
          latencyMs: 0,
          error: new Error('Redis circuit open'),
        });
      }
      return fallback;
    }

    try {
      return await this.record(op, key, fn, hitFromResult);
    } catch (error) {
      await this.handleOperationError(op, key, error);
      return fallback;
    }
  }

  // 健康检查
  async healthCheck(): Promise<HealthResult> {
    if (this.allEndpointsCircuitOpen()) {
      const firstCircuit = Array.from(this.endpointCircuits.values()).find(
        (circuit) => circuit.openUntil > Date.now(),
      );
      return {
        status: 'error',
        message: `Redis circuit open: ${firstCircuit?.reason ?? 'unknown'}`,
      };
    }

    if (!this.client || !this.isConnected) {
      return { status: 'error', message: 'Redis not connected' };
    }

    const now = Date.now();
    if (
      this.lastHealthResult &&
      now - this.lastHealthCheckAt < this.getHealthPingIntervalMs()
    ) {
      return this.lastHealthResult;
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latencyMs = Date.now() - start;
      this.metrics.record({ op: 'admin', key: 'PING', latencyMs });
      this.lastHealthCheckAt = now;
      this.lastHealthResult = { status: 'ok', latencyMs };
      return this.lastHealthResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ping failed';
      this.metrics.record({ op: 'admin', key: 'PING', latencyMs: 0, error });
      await this.handleOperationError('admin', 'PING', error);
      this.lastHealthCheckAt = now;
      this.lastHealthResult = { status: 'error', message };
      return this.lastHealthResult;
    }
  }

  // 基本操作
  async get(key: string): Promise<string | null> {
    return this.safeRecord(
      'read',
      key,
      null,
      () => this.client!.get(key),
      (v) => v !== null && v !== undefined,
    );
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.safeRecord('write', key, undefined, async () => {
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.client!.set(key, value, 'EX', Math.floor(ttlSeconds));
      } else {
        await this.client!.set(key, value);
      }
    });
  }

  async del(key: string): Promise<void> {
    await this.safeRecord('delete', key, undefined, async () => {
      await this.client!.del(key);
    });
  }

  async delByPrefix(prefix: string): Promise<number> {
    return this.safeRecord('delete', `${prefix}*`, 0, async () => {
      let deleted = 0;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client!.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client!.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');
      return deleted;
    });
  }

  async exists(key: string): Promise<boolean> {
    return this.safeRecord(
      'read',
      key,
      false,
      async () => (await this.client!.exists(key)) === 1,
      (v) => v,
    );
  }

  // JSON 操作
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // 获取连接状态
  get connected(): boolean {
    const active = this.endpointSpecs[this.activeEndpointIndex];
    return (
      !!this.client &&
      this.isConnected &&
      (!active || !this.isEndpointCircuitOpen(active))
    );
  }

  getRuntimeState(): RedisRuntimeState {
    const circuit = this.activeCircuit();
    // 2026-05: `circuitOpen` is now true ONLY when *every* configured
    // endpoint has tripped. A single endpoint's quota exhaustion no longer
    // makes the whole Redis subsystem look degraded as long as at least one
    // other endpoint is healthy.
    const allOpen = this.allEndpointsCircuitOpen();
    const circuitOpen = allOpen;
    const firstCircuit =
      circuit ??
      Array.from(this.endpointCircuits.values()).find(
        (entry) => entry.openUntil > Date.now(),
      ) ??
      null;
    const endpoint = this.endpointSpecs[this.activeEndpointIndex];
    return {
      configured: this.endpointSpecs.length > 0,
      connected: this.connected,
      activeEndpoint: endpoint?.label ?? null,
      circuitOpen,
      circuitOpenUntil: circuitOpen
        ? new Date(firstCircuit?.openUntil ?? Date.now()).toISOString()
        : null,
      circuitReason: circuitOpen ? (firstCircuit?.reason ?? null) : null,
      circuitMessage: circuitOpen ? (firstCircuit?.message ?? null) : null,
      endpointCount: this.endpointSpecs.length,
      availableEndpointCount: this.availableEndpointCount(),
      endpoints: this.endpointSpecs.map((spec, index) => {
        const entry = this.endpointCircuits.get(spec.label);
        const open = entry != null && entry.openUntil > Date.now();
        return {
          label: spec.label,
          active: index === this.activeEndpointIndex,
          circuitOpen: open,
          circuitOpenUntil:
            open && entry ? new Date(entry.openUntil).toISOString() : null,
          circuitReason: open && entry ? entry.reason : null,
          circuitMessage: open && entry ? entry.message : null,
        };
      }),
      lastErrorAt: this.lastErrorAt
        ? new Date(this.lastErrorAt).toISOString()
        : null,
      lastErrorKind: this.lastErrorKind,
      lastErrorMessage: this.lastErrorMessage,
      lastConnectedAt: this.lastConnectedAt
        ? new Date(this.lastConnectedAt).toISOString()
        : null,
      lastReconnectAttemptAt: this.lastReconnectAttemptAt
        ? new Date(this.lastReconnectAttemptAt).toISOString()
        : null,
      nextReconnectAt: this.nextReconnectAt
        ? new Date(this.nextReconnectAt).toISOString()
        : null,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // 获取原始客户端（高级用途）
  // Prefer RedisService wrapper methods. Raw client callers must explicitly
  // handle fallback or strict-fail behavior when Redis is unavailable.
  getClient(): RedisClient | null {
    if (!this.connected) return null;
    return this.client;
  }

  // List 操作（用于通知等）
  async lpush(key: string, value: string): Promise<number> {
    return this.safeRecord('write', key, 0, () =>
      this.client!.lpush(key, value),
    );
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.safeRecord(
      'read',
      key,
      [],
      () => this.client!.lrange(key, start, stop),
      (arr) => arr.length > 0,
    );
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.safeRecord('write', key, undefined, async () => {
      await this.client!.ltrim(key, start, stop);
    });
  }

  async lset(key: string, index: number, value: string): Promise<void> {
    await this.safeRecord('write', key, undefined, async () => {
      await this.client!.lset(key, index, value);
    });
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    return this.safeRecord('delete', key, 0, () =>
      this.client!.lrem(key, count, value),
    );
  }

  async incr(key: string): Promise<number> {
    return this.safeRecord('atomic', key, 0, () => this.client!.incr(key));
  }

  async decr(key: string): Promise<number> {
    return this.safeRecord('atomic', key, 0, () => this.client!.decr(key));
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.safeRecord('write', key, undefined, async () => {
      await this.client!.expire(key, seconds);
    });
  }

  // Set 操作（用于 tag-based 缓存管理）
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.safeRecord('write', key, 0, () =>
      this.client!.sadd(key, ...members),
    );
  }

  async smembers(key: string): Promise<string[]> {
    return this.safeRecord(
      'read',
      key,
      [],
      () => this.client!.smembers(key),
      (arr) => arr.length > 0,
    );
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.safeRecord('delete', key, 0, () =>
      this.client!.srem(key, ...members),
    );
  }

  /**
   * SET if Not eXists — returns true if the key was set, false if it already existed.
   * The default behavior is fail-open to preserve existing non-critical locks.
   */
  async setNX(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return this.safeRecord('atomic', key, true, async () => {
      const result = await this.client!.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    });
  }

  /**
   * Strict SET NX for automation locks. Redis failure returns false instead of
   * pretending a distributed lock was acquired.
   */
  async setNXStrict(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return this.safeRecord('atomic', key, false, async () => {
      const result = await this.client!.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    });
  }

  // 原子计数（用于配额/预算/计费等）
  async incrby(key: string, amount: number): Promise<number> {
    return this.safeRecord('atomic', key, 0, () =>
      this.client!.incrby(key, amount),
    );
  }

  // Hash 操作（用于 token-tracker 等按字段累加的计数器）
  async hincrby(key: string, field: string, amount: number): Promise<number> {
    return this.safeRecord('atomic', key, 0, () =>
      this.client!.hincrby(key, field, amount),
    );
  }

  async hincrbyfloat(
    key: string,
    field: string,
    amount: number,
  ): Promise<number> {
    return this.safeRecord('atomic', key, 0, async () =>
      Number(await this.client!.hincrbyfloat(key, field, amount)),
    );
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.safeRecord(
      'read',
      key,
      null,
      () => this.client!.hget(key, field),
      (v) => v !== null && v !== undefined,
    );
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.safeRecord('write', key, 0, () =>
      this.client!.hset(key, field, value),
    );
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.safeRecord(
      'read',
      key,
      {},
      () => this.client!.hgetall(key),
      (obj) => Object.keys(obj).length > 0,
    );
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.safeRecord('delete', key, 0, () =>
      this.client!.hdel(key, ...fields),
    );
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.safeRecord('write', key, 0, () =>
      this.client!.rpush(key, ...values),
    );
  }

  // Sorted Set 操作（用于 rate-limiter 滑动窗口、task-queue 优先级队列等）
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.safeRecord('write', key, 0, async () => {
      const result = await this.client!.zadd(key, score, member);
      return typeof result === 'number' ? result : Number(result) || 0;
    });
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.safeRecord(
      'read',
      key,
      [],
      () => this.client!.zrange(key, start, stop),
      (arr) => arr.length > 0,
    );
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    return this.safeRecord(
      'read',
      key,
      [],
      () => this.client!.zrangebyscore(key, min, max),
      (arr) => arr.length > 0,
    );
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.safeRecord('delete', key, 0, () =>
      this.client!.zrem(key, ...members),
    );
  }

  async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number> {
    return this.safeRecord('delete', key, 0, () =>
      this.client!.zremrangebyscore(key, min, max),
    );
  }

  async zcard(key: string): Promise<number> {
    return this.safeRecord('read', key, 0, () => this.client!.zcard(key));
  }

  // 毫秒精度 TTL（用于滑动窗口等）
  async pexpire(key: string, milliseconds: number): Promise<void> {
    await this.safeRecord('write', key, undefined, async () => {
      await this.client!.pexpire(key, milliseconds);
    });
  }

  async pttl(key: string): Promise<number> {
    // -2 = key does not exist (Redis convention) — a safe "unknown" fallback.
    return this.safeRecord('read', key, -2, () => this.client!.pttl(key));
  }

  /**
   * Metered escape hatch for advanced operations that have no dedicated wrapper
   * (Lua `eval`, pipelines, multi-step atomic sequences). The whole callback is
   * timed and recorded as ONE metrics sample under `op`, so these operations are
   * visible in the cache-health dashboard — closing the observability blind spot
   * where raw `getClient()` callers silently burned Redis quota (see #274).
   *
   * Unlike the `safe*` methods, this RE-THROWS driver errors and throws when
   * Redis is unavailable, so callers that keep their own in-memory fallback hit
   * their existing try/catch degradation path unchanged. Prefer a dedicated
   * wrapper when one fits; reach for this only when the operation genuinely
   * needs the raw client.
   */
  async withClient<T>(
    op: RedisOpKind,
    keyLabel: string,
    fn: (client: RedisClient) => Promise<T>,
  ): Promise<T> {
    if (!this.client || !this.connected) {
      const error = new Error('Redis unavailable');
      this.metrics.record({ op, key: keyLabel, latencyMs: 0, error });
      throw error;
    }
    const client = this.client;
    try {
      return await this.record(op, keyLabel, () => fn(client));
    } catch (error) {
      await this.handleOperationError(op, keyLabel, error);
      throw error;
    }
  }
}
