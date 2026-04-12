import { Test, TestingModule } from '@nestjs/testing';
import { ArchitectureValidatorService } from './architecture-validator.service';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ArchitectureValidatorService', () => {
  let service: ArchitectureValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchitectureValidatorService,
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn().mockImplementation(() => {
              throw new Error('not found');
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(ArchitectureValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have unknown status before initialization', () => {
    expect(service.aiSecurityStatus).toBe('unknown');
  });
});
