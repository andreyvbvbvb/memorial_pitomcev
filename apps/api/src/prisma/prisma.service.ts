import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "./prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function readPositiveInteger(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const pool = new Pool({
      connectionString,
      max: readPositiveInteger("PG_POOL_MAX", 20),
      connectionTimeoutMillis: readPositiveInteger("PG_POOL_CONNECTION_TIMEOUT_MS", 5000),
      idleTimeoutMillis: readPositiveInteger("PG_POOL_IDLE_TIMEOUT_MS", 30000)
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  getPoolMetrics() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      max: this.pool.options.max
    };
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
