/**
 * Tool Handler Interface
 *
 * Each domain tool service implements this interface to register
 * its tool handlers with the ToolExecutorService.
 */

export type ToolHandler = (
  args: Record<string, any>,
  userId: string,
  context: any,
  locale: string,
) => Promise<any>;

export interface IToolHandlerProvider {
  getHandlers(): Map<string, ToolHandler>;
}
