import { Inject, Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { cpus, freemem, loadavg, totalmem, uptime } from "node:os";
import { performance } from "node:perf_hooks";
import { PrismaService } from "../prisma/prisma.service";

type CpuBaseline = {
  usageMicros: number;
  measuredAtMicros: number;
};

type DatabaseMetricsRow = {
  database_name: string;
  max_connections: number;
  connections: number;
  active_connections: number;
  idle_connections: number;
  waiting_connections: number;
  blocked_locks: number;
  longest_query_ms: number | null;
  xact_commit: bigint | number;
  xact_rollback: bigint | number;
  blks_read: bigint | number;
  blks_hit: bigint | number;
  temp_files: bigint | number;
  temp_bytes: bigint | number;
  deadlocks: bigint | number;
};

const readText = async (paths: string[]) => {
  for (const path of paths) {
    try {
      return (await readFile(path, "utf8")).trim();
    } catch {
      // Try the next cgroup layout.
    }
  }
  return null;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseCpuStatUsageMicros = (value: string | null) => {
  if (!value) {
    return null;
  }
  const match = value.match(/^usage_usec\s+(\d+)$/m);
  return match ? Number(match[1]) : null;
};

@Injectable()
export class AdminPerformanceService {
  private processCpuBaseline: CpuBaseline | null = null;
  private cgroupCpuBaseline: CpuBaseline | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async readCgroupMetrics() {
    const [
      cpuStat,
      cpuMax,
      cpuUsageV1,
      cpuQuotaV1,
      cpuPeriodV1,
      memoryCurrent,
      memoryMax,
    ] = await Promise.all([
      readText(["/sys/fs/cgroup/cpu.stat"]),
      readText(["/sys/fs/cgroup/cpu.max"]),
      readText(["/sys/fs/cgroup/cpuacct/cpuacct.usage"]),
      readText(["/sys/fs/cgroup/cpu/cpu.cfs_quota_us"]),
      readText(["/sys/fs/cgroup/cpu/cpu.cfs_period_us"]),
      readText([
        "/sys/fs/cgroup/memory.current",
        "/sys/fs/cgroup/memory/memory.usage_in_bytes",
      ]),
      readText([
        "/sys/fs/cgroup/memory.max",
        "/sys/fs/cgroup/memory/memory.limit_in_bytes",
      ]),
    ]);

    const usageMicros =
      parseCpuStatUsageMicros(cpuStat) ??
      (cpuUsageV1 ? Number(cpuUsageV1) / 1000 : null);
    const measuredAtMicros = performance.now() * 1000;
    let cpuPercent: number | null = null;
    let usedCores: number | null = null;

    let cpuLimitCores = cpus().length;
    if (cpuMax) {
      const [quota, period] = cpuMax.split(/\s+/);
      if (quota && quota !== "max" && period) {
        cpuLimitCores = Number(quota) / Number(period);
      }
    } else if (cpuQuotaV1 && cpuPeriodV1 && Number(cpuQuotaV1) > 0) {
      cpuLimitCores = Number(cpuQuotaV1) / Number(cpuPeriodV1);
    }
    if (!Number.isFinite(cpuLimitCores) || cpuLimitCores <= 0) {
      cpuLimitCores = cpus().length;
    }

    if (usageMicros !== null && this.cgroupCpuBaseline) {
      const elapsedMicros =
        measuredAtMicros - this.cgroupCpuBaseline.measuredAtMicros;
      if (elapsedMicros > 0) {
        usedCores =
          (usageMicros - this.cgroupCpuBaseline.usageMicros) / elapsedMicros;
        cpuPercent = (usedCores / cpuLimitCores) * 100;
      }
    }
    if (usageMicros !== null) {
      this.cgroupCpuBaseline = { usageMicros, measuredAtMicros };
    }

    const currentMemoryBytes = memoryCurrent
      ? toFiniteNumber(memoryCurrent)
      : null;
    const parsedMemoryMax =
      memoryMax && memoryMax !== "max" ? toFiniteNumber(memoryMax) : null;
    const memoryLimitBytes =
      parsedMemoryMax && parsedMemoryMax < 2 ** 60 ? parsedMemoryMax : null;

    return {
      cpuPercent:
        cpuPercent === null ? null : Number(Math.max(0, cpuPercent).toFixed(2)),
      usedCores:
        usedCores === null ? null : Number(Math.max(0, usedCores).toFixed(3)),
      cpuLimitCores: Number(cpuLimitCores.toFixed(2)),
      memoryCurrentBytes: currentMemoryBytes,
      memoryLimitBytes,
      memoryPercent:
        currentMemoryBytes !== null && memoryLimitBytes
          ? Number(((currentMemoryBytes / memoryLimitBytes) * 100).toFixed(2))
          : null,
    };
  }

  private readProcessMetrics(cpuLimitCores: number) {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const usageMicros = cpu.user + cpu.system;
    const measuredAtMicros = performance.now() * 1000;
    let usedCores: number | null = null;
    let cpuPercent: number | null = null;

    if (this.processCpuBaseline) {
      const elapsedMicros =
        measuredAtMicros - this.processCpuBaseline.measuredAtMicros;
      if (elapsedMicros > 0) {
        usedCores =
          (usageMicros - this.processCpuBaseline.usageMicros) / elapsedMicros;
        cpuPercent = (usedCores / Math.max(0.01, cpuLimitCores)) * 100;
      }
    }
    this.processCpuBaseline = { usageMicros, measuredAtMicros };

    return {
      cpuPercent:
        cpuPercent === null ? null : Number(Math.max(0, cpuPercent).toFixed(2)),
      usedCores:
        usedCores === null ? null : Number(Math.max(0, usedCores).toFixed(3)),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      uptimeSeconds: Number(process.uptime().toFixed(1)),
    };
  }

  private async readDatabaseMetrics() {
    const beforePool = this.prisma.getPoolMetrics();
    const startedAt = performance.now();
    const rows = (await this.prisma.$queryRawUnsafe(`
      SELECT
        current_database() AS database_name,
        current_setting('max_connections')::int AS max_connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') AS active_connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') AS idle_connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND wait_event IS NOT NULL AND state <> 'idle') AS waiting_connections,
        (SELECT count(*)::int FROM pg_locks WHERE NOT granted) AS blocked_locks,
        (
          SELECT max(EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) * 1000)
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND state = 'active'
            AND pid <> pg_backend_pid()
        )::double precision AS longest_query_ms,
        stats.xact_commit,
        stats.xact_rollback,
        stats.blks_read,
        stats.blks_hit,
        stats.temp_files,
        stats.temp_bytes,
        stats.deadlocks
      FROM pg_stat_database AS stats
      WHERE stats.datname = current_database()
      LIMIT 1
    `)) as DatabaseMetricsRow[];
    const queryMs = performance.now() - startedAt;
    const row = rows[0];
    const afterPool = this.prisma.getPoolMetrics();

    return {
      queryMs: Number(queryMs.toFixed(2)),
      pool: {
        total: Math.max(beforePool.total, afterPool.total),
        idle: afterPool.idle,
        waiting: Math.max(beforePool.waiting, afterPool.waiting),
        max: afterPool.max,
      },
      database: row
        ? {
            name: row.database_name,
            maxConnections: toFiniteNumber(row.max_connections),
            connections: toFiniteNumber(row.connections),
            activeConnections: toFiniteNumber(row.active_connections),
            idleConnections: toFiniteNumber(row.idle_connections),
            waitingConnections: toFiniteNumber(row.waiting_connections),
            blockedLocks: toFiniteNumber(row.blocked_locks),
            longestQueryMs:
              row.longest_query_ms === null
                ? null
                : Number(toFiniteNumber(row.longest_query_ms).toFixed(2)),
            xactCommit: toFiniteNumber(row.xact_commit),
            xactRollback: toFiniteNumber(row.xact_rollback),
            blocksRead: toFiniteNumber(row.blks_read),
            blocksHit: toFiniteNumber(row.blks_hit),
            tempFiles: toFiniteNumber(row.temp_files),
            tempBytes: toFiniteNumber(row.temp_bytes),
            deadlocks: toFiniteNumber(row.deadlocks),
          }
        : null,
    };
  }

  async snapshot() {
    const cgroup = await this.readCgroupMetrics();
    const processMetrics = this.readProcessMetrics(cgroup.cpuLimitCores);
    const database = await this.readDatabaseMetrics();
    const [load1 = 0, load5 = 0, load15 = 0] = loadavg();
    const systemTotalMemory = totalmem();
    const systemFreeMemory = freemem();

    return {
      at: new Date().toISOString(),
      runtime: processMetrics,
      container: cgroup,
      system: {
        cpuCount: cpus().length,
        load1: Number(load1.toFixed(2)),
        load5: Number(load5.toFixed(2)),
        load15: Number(load15.toFixed(2)),
        totalMemoryBytes: systemTotalMemory,
        freeMemoryBytes: systemFreeMemory,
        usedMemoryPercent: Number(
          (((systemTotalMemory - systemFreeMemory) / systemTotalMemory) * 100).toFixed(
            2,
          ),
        ),
        uptimeSeconds: Number(uptime().toFixed(1)),
      },
      ...database,
    };
  }
}
