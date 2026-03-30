import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const KEY_PREFIX = 'mcp_';
const KEY_BYTES = 32;
const BCRYPT_ROUNDS = 10;

export interface McpKeyInfo {
  keyId: string;
  userId: string;
  role: string;
  name: string;
}

@Injectable()
export class McpApiKeyService {
  private readonly logger = new Logger(McpApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new MCP API key for a user.
   * Returns the plain key ONCE — it is stored hashed and cannot be recovered.
   */
  async generateKey(
    userId: string,
    name: string,
    expiresAt?: Date,
  ): Promise<{ key: string; keyId: string; keyPrefix: string }> {
    const rawBytes = crypto.randomBytes(KEY_BYTES);
    const plainKey = KEY_PREFIX + rawBytes.toString('hex');
    const keyPrefix = plainKey.slice(0, 12); // "mcp_" + 8 hex chars
    const keyHash = await bcrypt.hash(plainKey, BCRYPT_ROUNDS);

    const record = await this.prisma.mcpApiKey.create({
      data: {
        userId,
        keyHash,
        keyPrefix,
        name,
        expiresAt: expiresAt ?? null,
      },
    });

    this.logger.log(
      `Created MCP API key "${name}" (${keyPrefix}...) for user ${userId}`,
    );

    return { key: plainKey, keyId: record.id, keyPrefix };
  }

  /**
   * Validate a plain API key against stored hashes.
   * Uses prefix-based lookup to avoid full-table bcrypt comparison.
   */
  async validateKey(plainKey: string): Promise<McpKeyInfo | null> {
    if (!plainKey.startsWith(KEY_PREFIX) || plainKey.length < 20) {
      return null;
    }

    const prefix = plainKey.slice(0, 12);
    const candidates = await this.prisma.mcpApiKey.findMany({
      where: {
        keyPrefix: prefix,
        isRevoked: false,
      },
      include: {
        user: {
          select: { id: true, role: true, isBanned: true, deletedAt: true },
        },
      },
    });

    for (const candidate of candidates) {
      // Check expiration
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        continue;
      }

      const match = await bcrypt.compare(plainKey, candidate.keyHash);
      if (match) {
        // Verify user is active
        if (candidate.user.isBanned || candidate.user.deletedAt) {
          this.logger.warn(
            `MCP key ${prefix}... belongs to banned/deleted user ${candidate.userId}`,
          );
          return null;
        }

        return {
          keyId: candidate.id,
          userId: candidate.userId,
          role: candidate.user.role,
          name: candidate.name,
        };
      }
    }

    return null;
  }

  /** Update lastUsedAt timestamp (fire-and-forget). */
  async updateLastUsed(keyId: string): Promise<void> {
    await this.prisma.mcpApiKey
      .update({
        where: { id: keyId },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) =>
        this.logger.warn(`Failed to update lastUsedAt for key ${keyId}`, err),
      );
  }

  /** Revoke a key (soft delete). */
  async revokeKey(keyId: string): Promise<void> {
    await this.prisma.mcpApiKey.update({
      where: { id: keyId },
      data: { isRevoked: true },
    });
    this.logger.log(`Revoked MCP API key ${keyId}`);
  }

  /** List all keys for a user (no hashes returned). */
  async listKeys(userId?: string) {
    const where = userId ? { userId } : {};
    return this.prisma.mcpApiKey.findMany({
      where,
      select: {
        id: true,
        userId: true,
        keyPrefix: true,
        name: true,
        isRevoked: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
