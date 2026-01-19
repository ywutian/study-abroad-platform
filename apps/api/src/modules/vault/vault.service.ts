import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { EncryptionService } from './encryption.service';
import { Prisma, VaultItemType } from '@prisma/client';
import {
  CreateVaultItemDto,
  UpdateVaultItemDto,
  VaultQueryDto,
  VaultItemDto,
  VaultItemDetailDto,
  VaultStatsDto,
} from './dto';

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
    private encryptionService: EncryptionService,
  ) {}

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create a new vault item
   */
  async create(userId: string, dto: CreateVaultItemDto): Promise<VaultItemDto> {
    // Encrypt the data
    const { encryptedData, iv } = this.encryptionService.encrypt(
      dto.data,
      userId,
    );

    const item = await this.prisma.vaultItem.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        encryptedData,
        iv,
        category: dto.category,
        tags: dto.tags || [],
        icon: dto.icon,
      },
    });

    return this.toVaultItemDto(item);
  }

  /**
   * Get all vault items for a user (without decrypted data)
   */
  async findAll(userId: string, query: VaultQueryDto): Promise<VaultItemDto[]> {
    const where: Prisma.VaultItemWhereInput = { userId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { tags: { hasSome: [query.search] } },
      ];
    }

    const items = await this.prisma.vaultItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return items.map(this.toVaultItemDto);
  }

  /**
   * Get a single vault item with decrypted data
   */
  async findOne(userId: string, itemId: string): Promise<VaultItemDetailDto> {
    const item = this.auth.verifyOwnership(
      await this.prisma.vaultItem.findUnique({ where: { id: itemId } }),
      userId,
      { entityName: 'Vault item' },
    );

    // Decrypt the data
    const decryptedData = this.encryptionService.decrypt(
      item.encryptedData,
      item.iv,
      userId,
    );

    return {
      ...this.toVaultItemDto(item),
      data: decryptedData,
    };
  }

  /**
   * Update a vault item
   */
  async update(
    userId: string,
    itemId: string,
    dto: UpdateVaultItemDto,
  ): Promise<VaultItemDto> {
    this.auth.verifyOwnership(
      await this.prisma.vaultItem.findUnique({ where: { id: itemId } }),
      userId,
      { entityName: 'Vault item' },
    );

    const updateData: Prisma.VaultItemUpdateInput = {};

    if (dto.title) updateData.title = dto.title;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.tags) updateData.tags = dto.tags;
    if (dto.icon !== undefined) updateData.icon = dto.icon;

    // If data is being updated, re-encrypt it
    if (dto.data) {
      const { encryptedData, iv } = this.encryptionService.encrypt(
        dto.data,
        userId,
      );
      updateData.encryptedData = encryptedData;
      updateData.iv = iv;
    }

    const updated = await this.prisma.vaultItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return this.toVaultItemDto(updated);
  }

  /**
   * Delete a vault item
   */
  async delete(userId: string, itemId: string): Promise<void> {
    this.auth.verifyOwnership(
      await this.prisma.vaultItem.findUnique({ where: { id: itemId } }),
      userId,
      { entityName: 'Vault item' },
    );

    await this.prisma.vaultItem.delete({ where: { id: itemId } });
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Get vault statistics for a user
   */
  async getStats(userId: string): Promise<VaultStatsDto> {
    const [counts, categories] = await Promise.all([
      this.prisma.vaultItem.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      }),
      this.prisma.vaultItem.findMany({
        where: { userId, category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      }),
    ]);

    const countMap: Partial<Record<VaultItemType, number>> = {};

    counts.forEach((c) => {
      countMap[c.type] = c._count;
    });

    const totalItems = Object.values(countMap).reduce(
      (a, b) => (a ?? 0) + (b ?? 0),
      0,
    );

    return {
      totalItems,
      credentialCount: countMap.CREDENTIAL ?? 0,
      documentCount: countMap.DOCUMENT ?? 0,
      noteCount: countMap.NOTE ?? 0,
      certificateCount: countMap.API_KEY ?? 0,
      categories: categories.map((c) => c.category).filter(Boolean) as string[],
    };
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Delete all vault items for a user
   */
  async deleteAll(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.vaultItem.deleteMany({
      where: { userId },
    });

    return { count: result.count };
  }

  /**
   * Export all vault items (decrypted)
   */
  async exportAll(userId: string): Promise<VaultItemDetailDto[]> {
    const items = await this.prisma.vaultItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((item) => {
      const decryptedData = this.encryptionService.decrypt(
        item.encryptedData,
        item.iv,
        userId,
      );

      return {
        ...this.toVaultItemDto(item),
        data: decryptedData,
      };
    });
  }

  /**
   * Import vault items
   */
  async importItems(
    userId: string,
    items: Array<{
      type: string;
      title: string;
      data: string;
      category?: string;
      tags?: string[];
    }>,
  ): Promise<{ imported: number }> {
    let imported = 0;

    for (const item of items) {
      // Validate and convert type string to VaultItemType enum
      const vaultType = this.parseVaultItemType(item.type);
      if (!vaultType) {
        this.logger.warn(`Skipping invalid vault item type: ${item.type}`);
        continue;
      }

      const { encryptedData, iv } = this.encryptionService.encrypt(
        item.data,
        userId,
      );

      await this.prisma.vaultItem.create({
        data: {
          userId,
          type: vaultType,
          title: item.title,
          encryptedData,
          iv,
          category: item.category,
          tags: item.tags || [],
        },
      });

      imported++;
    }

    return { imported };
  }

  /**
   * Parse string to VaultItemType enum
   */
  private parseVaultItemType(type: string): VaultItemType | null {
    const validTypes: string[] = [
      'PASSWORD',
      'CREDENTIAL',
      'DOCUMENT',
      'NOTE',
      'API_KEY',
      'OTHER',
    ];
    const upperType = type.toUpperCase() as VaultItemType;
    return validTypes.includes(upperType) ? upperType : null;
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Generate a secure password
   */
  generatePassword(length: number = 16): string {
    return this.encryptionService.generatePassword(length);
  }

  // ============================================
  // Private Helpers
  // ============================================

  private toVaultItemDto(item: {
    id: string;
    type: VaultItemType;
    title: string;
    category: string | null;
    tags: string[];
    icon: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): VaultItemDto {
    return {
      id: item.id,
      type: item.type as any,
      title: item.title,
      category: item.category || undefined,
      tags: item.tags,
      icon: item.icon || undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
