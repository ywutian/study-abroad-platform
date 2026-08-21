import { MODULE_METADATA } from '@nestjs/common/constants';
import { AgentHarnessOperationsService } from '../core/agent-harness-operations.service';
import { AiAgentMemoryModule } from './memory.module';

describe('AiAgentMemoryModule Harness wiring', () => {
  it('provides and exports Harness operations to context and parent consumers', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AiAgentMemoryModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      AiAgentMemoryModule,
    ) as unknown[];

    expect(providers).toContain(AgentHarnessOperationsService);
    expect(exports).toContain(AgentHarnessOperationsService);
  });
});
