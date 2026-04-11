# Claude Code — Architecture Document

> Comprehensive technical reference for the Claude Code CLI codebase.
> Source: `/Users/yitianwu/Documents/claude-code/`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Bootstrap & Entry Points](#2-bootstrap--entry-points)
3. [Core Query Loop](#3-core-query-loop)
4. [Tool System](#4-tool-system)
5. [Agent System](#5-agent-system)
6. [Multi-Agent Coordination](#6-multi-agent-coordination)
7. [State Management](#7-state-management)
8. [Context System](#8-context-system)
9. [Messages & Compaction](#9-messages--compaction)
10. [Permission System](#10-permission-system)
11. [MCP Integration](#11-mcp-integration)
12. [Memory System](#12-memory-system)
13. [Skills System](#13-skills-system)
14. [Hooks System](#14-hooks-system)
15. [Configuration System](#15-configuration-system)
16. [Cost Tracking](#16-cost-tracking)
17. [Bridge & Remote Execution](#17-bridge--remote-execution)
18. [Key Design Patterns](#18-key-design-patterns)

---

## 1. Overview

Claude Code is Anthropic's official CLI for Claude, providing an interactive agent that assists users with software engineering tasks. It is available as a CLI tool, desktop app (Mac/Windows), web app (claude.ai/code), and IDE extensions (VS Code, JetBrains).

### High-Level Architecture

```
User Input (CLI / IDE / Web)
    │
    ▼
┌──────────────────────────────────────────────┐
│              Entry Points                     │
│  cli.tsx │ SDK │ MCP Server │ Bridge │ Remote │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│              QueryEngine                      │
│  System Prompt Assembly │ Message Management  │
│  Auto-Compact │ Cost Tracking │ Turn Control  │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│              Query Loop (query.ts)            │
│  API Call → Tool Execution → Recovery Loop    │
│  Streaming │ Compaction │ Budget Enforcement  │
└──────────────────┬───────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│  Tool System │  │  Agent System     │
│  41+ tools   │  │  Subagents        │
│  MCP tools   │  │  Coordinator      │
│  Permissions │  │  Tasks            │
└──────────────┘  └──────────────────┘
```

### Key Directories

| Directory        | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `entrypoints/`   | CLI dispatcher, MCP server, SDK types         |
| `QueryEngine.ts` | Per-conversation query lifecycle manager      |
| `query.ts`       | Main query loop (async generator)             |
| `tools/`         | 41+ tool implementations                      |
| `tasks/`         | Task lifecycle (LocalAgent, Remote, Teammate) |
| `coordinator/`   | Multi-agent orchestration mode                |
| `state/`         | AppState store and reactive state management  |
| `context/`       | System prompt, user/tool context builders     |
| `services/`      | MCP, analytics, API client, compaction        |
| `hooks/`         | 76+ reactive hook files                       |
| `memdir/`        | Persistent file-based memory                  |
| `permissions/`   | Sandbox, policy, denial tracking              |
| `constants/`     | Prompts, XML tags, configuration constants    |
| `bridge/`        | Remote control and bridge sessions            |
| `bootstrap/`     | Global session state                          |
| `components/`    | UI/React components (146 directories)         |
| `utils/`         | Utility functions (330+ files)                |

---

## 2. Bootstrap & Entry Points

### CLI Entry (`entrypoints/cli.tsx`)

Uses a **fast-path architecture** to minimize module loading for common operations:

| Fast Path                    | Behavior                          |
| ---------------------------- | --------------------------------- |
| `--version` / `-v`           | Zero imports beyond version macro |
| `--dump-system-prompt`       | Output system prompt for eval     |
| `--daemon-worker`            | Lean per-worker startup           |
| `claude remote-control/rc`   | Bridge mode                       |
| `claude daemon`              | Long-running supervisor           |
| `claude ps/logs/attach/kill` | Session management                |
| `--bg/--background`          | Background session spawning       |

For non-fast-path invocations, the full CLI is loaded with React/Ink rendering.

### Initialization System (`entrypoints/init.ts`)

One-time setup after trust dialog, memoized to prevent re-initialization:

```
1. Config validation → enable config system, apply safe env vars
2. Infrastructure → graceful shutdown handler, TLS certificates
3. Async init (non-blocking):
   - 1P event logging, OAuth account info
   - JetBrains/IDE detection, GitHub repo detection
   - Remote settings & policy limits
4. Network → mTLS, proxy agents, API preconnection
5. Feature-gated setup → upstream proxy, scratchpad directory
6. Telemetry → initializeTelemetryAfterTrust()
```

### Bootstrap State (`bootstrap/state.ts`)

Global mutable singleton shared across CLI lifetime:

```typescript
// Key fields (simplified)
{
  sessionId: SessionId,           // Unique per session
  parentSessionId?: SessionId,    // Plan mode lineage
  originalCwd: string,            // Stable project root
  totalCostUSD: number,
  modelUsage: Record<string, ModelUsage>,
  mainLoopModelOverride?: ModelSetting,
  registeredHooks: RegisteredHookMatcher[],
  sessionBypassPermissionsMode: boolean,
  systemPromptSectionCache: Map<string, string | null>,
  // ... 50+ getters/setters
}
```

---

## 3. Core Query Loop

### QueryEngine (`QueryEngine.ts`)

Class-based query lifecycle manager — one instance per conversation, persists across turns.

**Key configuration:**

```typescript
QueryEngineConfig {
  cwd, tools, commands, mcpClients, agents, canUseTool,
  getAppState, setAppState,
  readFileCache, customSystemPrompt, appendSystemPrompt,
  userSpecifiedModel, thinkingConfig, maxTurns, maxBudgetUsd,
  snipReplay,  // SDK-only history snip
}
```

**Mutable state across turns:**

- `mutableMessages: Message[]` — persisted conversation
- `abortController` — turn cancellation
- `permissionDenials: SDKPermissionDenial[]` — denial tracking
- `totalUsage: NonNullableUsage` — cumulative token usage
- `discoveredSkillNames: Set<string>` — per-turn, cleared at start
- `loadedNestedMemoryPaths: Set<string>` — session-wide dedup

**`submitMessage(prompt, options)` flow:**

```
1. System prompt assembly (base + user + system context)
2. Inject memory mechanics (if auto memory + custom prompt)
3. Process slash commands, attachments, model selection
4. Record transcript (persisted before API call for resumability)
5. Execute query() generator
6. Collect messages + track permission denials
7. Return Terminal { messages, cost, usage }
```

### Query Loop (`query.ts`)

Async generator that drives the conversation:

```typescript
async function* query(params: QueryParams):
  AsyncGenerator<StreamEvent | Message | ToolUseSummaryMessage, Terminal>
```

**Loop flow per iteration:**

```
1. Normalize messages (strip ANSI, handle incomplete tool results)
2. Resolve thinking config (adaptive/fixed/disabled)
3. Build API request:
   - Prepend userContext, append systemContext
   - Handle image stripping for compaction
   - Apply tool result budget (aggregate compaction)
4. Stream API call via queryModelWithStreaming()
5. Execute tools via StreamingToolExecutor
6. Recovery loops:
   - max_output_tokens → retry with lower budget
   - Reactive compact → pre-emptively shrink context
   - Session memory compact → summarize memory files
7. Yield messages to caller (SDK or REPL)
8. Continue until stop_reason: 'end_turn' or max turns
```

**Transition reasons (why the loop continues):**

- `max_output_tokens_recovery` — model hit output limit
- `reactive_compact` — context approaching limit
- `session_memory_compact` — memory files need distillation

**Mutable query state:**

```typescript
type State = {
  messages: Message[];
  toolUseContext: ToolUseContext;
  autoCompactTracking?: AutoCompactTrackingState;
  maxOutputTokensRecoveryCount: number;
  hasAttemptedReactiveCompact: boolean;
  pendingToolUseSummary?: Promise<ToolUseSummaryMessage>;
  stopHookActive?: boolean;
  turnCount: number;
  transition?: Continue;
};
```

---

## 4. Tool System

### Tool Interface (`Tool.ts`)

Every tool implements:

```typescript
type Tool<Input, Output, Progress> = {
  name: string;
  aliases?: string[];
  searchHint?: string;
  inputSchema: ZodSchema;
  inputJSONSchema?: ToolInputJSONSchema; // For MCP tools

  // Execution
  call(args, context, canUseTool, parentMessage, onProgress?): Promise<ToolResult>;

  // Metadata
  description(input, options): Promise<string>;
  isConcurrencySafe(input): boolean; // Can run in parallel?
  isEnabled(): boolean;
  isReadOnly(input): boolean;
  isDestructive?(input): boolean;
  isSearchOrReadCommand?(input): boolean;
  maxResultSizeChars: number;
  shouldDefer?: boolean; // Lazy schema loading

  // Permission
  checkPermissions(input, context): Promise<PermissionResult>;

  // Rendering (Ink/React)
  renderToolUseMessage(input, options);
  renderToolResultMessage(content, progressMessages, options);
};
```

**Builder pattern:** `buildTool(def)` fills in safe defaults (isEnabled → true, isConcurrencySafe → false, isReadOnly → false).

### Tool Registry (`tools.ts`)

**41+ tool directories:**

| Category            | Tools                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **File Operations** | FileRead, FileWrite, FileEdit, Glob, Grep                                |
| **Shell**           | Bash, PowerShell                                                         |
| **Agent**           | AgentTool, SendMessage, TaskCreate/Get/Update/List, TaskOutput, TaskStop |
| **Plan Mode**       | EnterPlanMode, ExitPlanMode                                              |
| **Worktree**        | EnterWorktree, ExitWorktree                                              |
| **MCP**             | MCPTool, ListMcpResources, ReadMcpResource, McpAuth                      |
| **Web**             | WebFetch, WebSearch                                                      |
| **Notebook**        | NotebookEdit                                                             |
| **Scheduling**      | CronCreate, CronDelete, CronList, RemoteTrigger                          |
| **UI/Control**      | AskUserQuestion, Brief, Sleep, SyntheticOutput, ToolSearch               |
| **Skills**          | SkillTool                                                                |
| **Todo**            | TodoWrite                                                                |
| **Teams**           | TeamCreate, TeamDelete                                                   |
| **Other**           | LSPTool, REPL (ant-only), Config (ant-only)                              |

**Assembly functions:**

```typescript
getAllBaseTools(); // Exhaustive list (respects feature flags)
getTools(permissions); // Filtered by permission rules
assembleToolPool(permissions, mcpTools); // Built-in + MCP, deduplicated
filterToolsByDenyRules(tools, permissions); // Permission-based filtering
```

**Deferred loading:** Tools with `shouldDefer: true` are loaded lazily via `ToolSearch`. Their schema is not sent to the API until explicitly requested, reducing prompt size.

### Streaming Tool Executor (`services/tools/StreamingToolExecutor.ts`)

Orchestrates concurrent tool execution:

```typescript
class StreamingToolExecutor {
  tools: TrackedTool[]; // Queue of pending tools
  siblingAbortController; // Shared abort for parallel tools
}

type TrackedTool = {
  id: string;
  status: 'queued' | 'executing' | 'completed' | 'yielded';
  isConcurrencySafe: boolean;
  results?: Message[];
  contextModifiers?: Array<(ctx) => ctx>;
};
```

**Concurrency rules:**

- Concurrent-safe tools run in parallel (e.g., multiple file reads)
- Exclusive tools (e.g., Bash) wait for all executors to finish
- Results yielded in **queue order** (not completion order) for deterministic output
- Sibling abort: if one tool errors, parallel siblings are cancelled

**Abort reasons:**

- `sibling_error` — another parallel tool errored
- `user_interrupted` — ESC during tool execution
- `streaming_fallback` — streaming retry discarded this attempt

### ToolUseContext

Shared context passed to ALL tool executions:

```typescript
type ToolUseContext = {
  options: {
    commands: Command[]
    tools: Tools
    mcpClients: MCPServerConnection[]
    agentDefinitions: AgentDefinitionsResult
    maxBudgetUsd?: number
    refreshTools?: () => Tools   // Mid-query MCP connections
  }
  abortController: AbortController
  readFileState: FileStateCache     // LRU file content cache
  getAppState(): AppState
  setAppState(f): void
  setAppStateForTasks?: (f): void   // Always reaches root store

  // Agent context
  agentId?: AgentId
  agentType?: string
  messages: Message[]

  // Memory
  nestedMemoryAttachmentTriggers?: Set<string>
  loadedNestedMemoryPaths?: Set<string>

  // UI callbacks
  setToolJSX?: (jsx) => void
  appendSystemMessage?: (msg) => void
  sendOSNotification?: (opts) => void
}
```

---

## 5. Agent System

### Agent Definition Types

Three sources of agent definitions:

```typescript
type AgentDefinition =
  | BuiltInAgentDefinition // Hardcoded system agents
  | CustomAgentDefinition // User/project .claude/agents/*.md
  | PluginAgentDefinition; // Plugin-provided agents

type BaseAgentDefinition = {
  agentType: string; // Unique identifier
  whenToUse: string; // Description for routing
  tools?: string[]; // Tool whitelist
  disallowedTools?: string[]; // Tool blacklist
  model?: string; // 'sonnet' | 'opus' | 'haiku' | 'inherit'
  maxTurns?: number; // Prevent runaway
  permissionMode?: PermissionMode; // 'default' | 'plan' | 'bubble'
  isolation?: 'worktree' | 'remote';
  skills?: string[]; // Preloaded slash commands
  mcpServers?: AgentMcpServerSpec[];
  hooks?: HooksSettings;
  background?: boolean; // Always run async
  memory?: 'user' | 'project' | 'local';
  omitClaudeMd?: boolean;
  color?: AgentColorName;
  effort?: EffortValue;
};
```

### Built-In Agents (`builtInAgents.ts`)

| Agent               | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| GENERAL_PURPOSE     | Default subagent for multi-step tasks                |
| EXPLORE             | Fast codebase exploration (read-only tools)          |
| PLAN                | Software architecture planning                       |
| STATUSLINE_SETUP    | Configure status line settings                       |
| VERIFICATION        | Experimental code verification                       |
| FORK                | Context-inheriting child (prompt cache optimization) |
| Coordinator workers | Worker agents in coordinator mode                    |

### Custom Agent Loading (`loadAgentsDir.ts`)

Agents loaded from markdown files with YAML frontmatter:

```markdown
---
name: my-agent
description: What this agent does
tools: Read, Grep, Glob, Bash
model: opus
maxTurns: 20
---

## System prompt content here

Instructions for the agent...
```

**Priority order (later overrides earlier):**

1. Built-in agents
2. Plugin agents
3. User agents (`~/.claude/agents/`)
4. Project agents (`.claude/agents/`)
5. Feature flag agents
6. Policy/managed agents

**Filtering:**

- MCP server requirements checked (`hasRequiredMcpServers()`)
- Permission deny rules filter agents
- Plan mode hides destructive agents

### Agent Tool (`AgentTool.tsx`)

**Input schema:**

```typescript
{
  prompt: string              // Task description
  description: string         // 3-5 word summary
  subagent_type?: string      // Agent type (default: general-purpose)
  model?: 'sonnet' | 'opus' | 'haiku'
  run_in_background?: boolean
  isolation?: 'worktree' | 'remote'
  name?: string               // Addressable name (for SendMessage)
  team_name?: string          // Team context
  mode?: PermissionMode
  cwd?: string                // Working directory override
}
```

**Execution dispatch:**

```
Agent Tool call
  ├─ Sync path (awaited)
  │  └─ runAgent() → LocalAgentTask
  │     ├─ Initialize agent MCP servers
  │     ├─ Build system prompt from agent definition
  │     ├─ Create isolated FileStateCache
  │     ├─ Register cleanup handlers
  │     └─ Run query() loop until completion
  │
  └─ Async path (background)
     ├─ registerAsyncAgent() → AppState.tasks
     ├─ Return immediately with task ID
     └─ Notify main session on completion
```

### Agent Execution (`runAgent.ts`)

~1000 lines handling the full agent lifecycle:

1. **MCP initialization** — shared clients (string refs) reused, inline defs (object specs) cleaned up
2. **Tool resolution** — whitelist/blacklist applied from agent definition
3. **System prompt** — agent markdown body + context hierarchy (CLAUDE.md, memory)
4. **Query loop** — same `query()` generator as main session
5. **Result collection** — final message returned to parent

**Fork subagent optimization:** Fork children inherit parent's frozen system prompt for prompt cache hits. Guard prevents recursive forks (`isInForkChild()`).

### Task System (`tasks/`)

Tasks track background agent lifecycle:

```typescript
type TaskType =
  | 'local_bash' // Shell command
  | 'local_agent' // Subagent (fork)
  | 'remote_agent' // Remote CCR session
  | 'in_process_teammate' // Multi-agent swarm
  | 'local_workflow' // Workflow script
  | 'monitor_mcp' // MCP health
  | 'dream'; // Memory distillation

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed';
```

**Task state base:**

```typescript
type TaskStateBase = {
  id: string; // Prefix + 8-char random
  type: TaskType;
  status: TaskStatus;
  description: string;
  toolUseId?: string; // Which tool_use spawned it
  startTime: number;
  endTime?: number;
  outputFile: string; // Disk output path
  outputOffset: number; // Current read position
  notified: boolean; // Completion notification sent?
};
```

**LocalAgentTask additions:**

```typescript
{
  agentId: string
  prompt: string
  agentType: string
  model?: string
  result?: AgentToolResult
  progress?: AgentProgress      // Tool count, tokens, recent activities
  messages?: Message[]          // Full transcript
  isBackgrounded: boolean
  pendingMessages: string[]     // SendMessage queue
  retain: boolean               // UI holding (blocks eviction)
}
```

**Progress tracking:**

```typescript
type AgentProgress = {
  toolUseCount: number;
  tokenCount: number;
  lastActivity?: ToolActivity;
  recentActivities?: ToolActivity[]; // Last 5 tools
  summary?: string;
};
```

**Lifecycle functions:**

- `registerAsyncAgent()` — create task in AppState
- `updateAsyncAgentProgress()` — delta tracking
- `completeAgentTask()` / `failAgentTask()` / `killAsyncAgent()` — terminal states
- `queuePendingMessage()` / `drainPendingMessages()` — SendMessage queue
- `enqueueAgentNotification()` — XML notification for model

**Eviction & GC:**

- Foreground tasks: never evicted
- Background retained: `retain=true` blocks eviction
- Background released: `evictAfter=<timestamp>` for 2s grace, then GC
- Output persistence: task output stays on disk after eviction

---

## 6. Multi-Agent Coordination

### Coordinator Mode (`coordinator/`)

Enabled via `CLAUDE_CODE_COORDINATOR_MODE` env var.

**Architecture:** One coordinator agent spawns and manages worker agents.

**Coordinator tools:** Agent, SendMessage, TaskStop
**Worker tools:** Standard tools (Bash, Read, Edit, etc.) + MCP tools + Skills — but NOT Agent, SendMessage, or TaskStop

**Task notifications** delivered as XML to the coordinator:

```xml
<task-notification>
  <task-id>agent-a1b</task-id>
  <status>completed|failed|killed</status>
  <summary>Human-readable status</summary>
  <result>Agent's final response</result>
  <usage>
    <total_tokens>N</total_tokens>
    <tool_uses>N</tool_uses>
    <duration_ms>N</duration_ms>
  </usage>
</task-notification>
```

### SendMessage Tool (`SendMessageTool/`)

Inter-agent communication:

```typescript
Input = {
  to: string     // Recipient:
    // - Teammate name (e.g., "alice")
    // - "*" for broadcast
    // - "uds:<socket>" for local peer
    // - "bridge:<session>" for remote peer
  summary?: string    // 5-10 word preview
  message: string | StructuredMessage
}

StructuredMessage =
  | { type: 'shutdown_request', reason? }
  | { type: 'shutdown_response', request_id, approve, reason? }
  | { type: 'plan_approval_response', request_id, approve, feedback? }
```

**Routing paths:**

1. **Local agents** — queue via `queuePendingMessage()`
2. **Teammates** — write to in-process mailbox
3. **Remote peers** — send to socket/bridge connection
4. **Broadcast** (`"*"`) — deliver to all active teammates

**Message delivery timing:** Pending messages drained at tool-round boundaries (not mid-turn) to prevent races.

### InProcessTeammateTask

Same-process multi-agent (tmux-style):

```typescript
{
  type: 'in_process_teammate'
  identity: TeammateIdentity    // agentId, name, team, color
  prompt: string
  awaitingPlanApproval: boolean
  permissionMode: PermissionMode
  pendingUserMessages: string[]
  isIdle: boolean
  messages?: Message[]          // UI cap: 50 recent
}
```

- Runs in same process as coordinator
- Async event loop with idle detection
- Full context sharing (system prompt, tools)
- Mailbox-based messaging

---

## 7. State Management

### AppState (`state/AppStateStore.ts`)

Core mutable application state, wrapped in `DeepImmutable<>`:

```typescript
type AppState = {
  // Settings
  settings: SettingsJson           // User, project, MDM, policy
  verbose: boolean
  mainLoopModel: ModelSetting
  mainLoopModelForSession: ModelSetting

  // UI
  statusLineText?: string
  expandedView: 'none' | 'tasks' | 'teammates'
  isBriefOnly: boolean
  expandedMessage?: UUID
  messageFilterMode: 'none' | 'agent' | 'human'
  notification: Notification
  spinnerTip?: string

  // Permissions
  toolPermissionContext: ToolPermissionContext

  // Tasks & Agents
  tasks: TaskState[]
  selectedIPAgentIndex: number
  coordinatorTaskIndex: number

  // Remote
  remoteSessionUrl?: string
  remoteConnectionStatus: ConnectionStatus
  replBridgeEnabled/Connected/Active: boolean

  // File tracking
  fileHistory: FileHistoryState
  attribution: AttributionState

  // Performance
  speculationState: SpeculationState   // idle or active with timeSaved
}
```

### Store Pattern

```typescript
type Store<T> = {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
};
```

**State change tracking** (`onChangeAppState.ts`):

- Computes diffs between old and new state
- Triggers side effects: autosave settings, theme application
- Prevents thrashing from rapid updates

---

## 8. Context System

### System Prompt Assembly

Two-layer system:

1. **Base system prompt** (model-specific):
   - Core capability instructions
   - Tool descriptions
   - Permission model explanation
   - Thinking rules (if enabled)

2. **Runtime context injection:**
   - `userContext`: Git status, repo info, environment
   - `systemContext`: Timestamp, working directory, tool lists
   - Memory mechanics prompt (if auto memory enabled)
   - Append prompt (SDK/caller-provided)

### System Prompt Section Caching (`constants/systemPromptSections.ts`)

```typescript
// Cached section (memoized, preserves prompt cache)
systemPromptSection(name, compute: () => string | null)

// Volatile section (recomputes every turn, BREAKS prompt cache)
DANGEROUS_uncachedSystemPromptSection(name, compute, reason)

// Resolve all sections in parallel
resolveSystemPromptSections(sections): Promise<(string | null)[]>

// Clear cache on /clear and /compact
clearSystemPromptSections()
```

**Why caching matters:** Prompt prefix stability enables multi-turn cache hits on the Anthropic API, significantly reducing latency and cost.

### Git Context (memoized, ~100ms)

```
Current branch, main branch, git user
Recent commits (git log -5)
Git status (truncated to 2k chars)
Staged/unstaged changes
```

---

## 9. Messages & Compaction

### Message Types

All messages share a common structure:

```typescript
{
  type: 'user' | 'assistant' | 'system'
  uuid: UUID                    // Stable per message
  message: { content: ContentBlockParam[] }
  timestamp: number
  origin: MessageOrigin
  isMeta?: boolean              // Synthetic caveat messages
}
```

**System message subtypes:**
`compact_boundary`, `microcompact_boundary`, `local_command`, `api_error`, `api_metrics`, `permission_retry`, `turn_duration`, `away_summary`, `scheduled_task_fire`, `stop_hook_summary`

### Auto-Compact (`services/compact/autoCompact.ts`)

Triggers when context approaches the window limit.

**Thresholds (per model):**

| Threshold              | Value                               |
| ---------------------- | ----------------------------------- |
| `autoCompactThreshold` | effectiveContextWindow - 13K buffer |
| `warningThreshold`     | -20K from limit                     |
| `errorThreshold`       | -20K from limit                     |
| `blockingLimit`        | limit - 3K (forces manual compact)  |

**Tracking state:**

```typescript
type AutoCompactTrackingState = {
  compacted: boolean;
  turnCounter: number;
  turnId: string;
  consecutiveFailures?: number; // Circuit breaker at 3
};
```

### Compaction Process (`services/compact/compact.ts`)

```
1. Strip images/documents from messages (avoid prompt-too-long)
2. Generate compact boundary system message
3. Call compactConversation() with:
   - Original messages
   - Custom compact prompt
   - Max output: 20K tokens
4. Post-compact recovery:
   - Restore up to 5 files (50K token budget)
   - Restore skills: per-skill 5K, total 25K budget
   - Restore agent listings + MCP instruction deltas
```

**Snip compaction** (feature-gated `HISTORY_SNIP`):

- Replays snipped boundaries with projected view
- Bounds memory in long headless sessions
- Keeps full history in REPL for UI scrollback

### Tool Result Budget (`utils/toolResultStorage.ts`)

Aggregate tool result compaction:

- Tracks which `toolUseId` → `tool_result` blocks fit in budget
- Replaces oversized results with tombstone markers
- Budget per conversation (not per turn)
- Mutable state in `ToolUseContext.contentReplacementState`

---

## 10. Permission System

### Permission Modes

```typescript
type PermissionMode =
  | 'default' // Ask for each permission
  | 'plan' // Pause on permission prompts
  | 'acceptEdits' // Auto-accept edit tools
  | 'bypassPermissions' // Auto-approve all tool use
  | 'dontAsk' // Deny all, suppress prompts
  | 'auto' // Classifier-driven (ant-only)
  | 'bubble'; // Legacy internal mode
```

### ToolPermissionContext

```typescript
type ToolPermissionContext = {
  mode: PermissionMode;
  additionalWorkingDirectories: Map<string, AdditionalWorkingDirectory>;
  alwaysAllowRules: ToolPermissionRulesBySource;
  alwaysDenyRules: ToolPermissionRulesBySource;
  alwaysAskRules: ToolPermissionRulesBySource;
  isBypassPermissionsModeAvailable: boolean;
  isAutoModeAvailable?: boolean;
  strippedDangerousRules?: ToolPermissionRulesBySource;
  shouldAvoidPermissionPrompts?: boolean; // Background agents
};
```

### Permission Check Flow

```
Tool use block detected
    │
    ▼
canUseTool() called
    ├── Check alwaysAllowRules (mode-specific)
    ├── Check alwaysDenyRules
    ├── If auto mode → run yoloClassifier()
    ├── Otherwise → show permission prompt UI
    └── Return { behavior: 'allow' | 'deny' | 'prompt' }
    │
    ▼
If allowed → execute tool
If denied → yield denial message, continue without tool
```

### Permission Rules

Rules are loaded from `~/.claude/permissions/rules.json`:

- **Filesystem rules**: path patterns (allow/deny/ask)
- **Bash rules**: command patterns (deny dangerous: `rm -rf`, fork bombs, etc.)
- **MCP rules**: server/resource patterns

### Denial Tracking (`denialTracking.ts`)

- Accumulates permission denials per tool/scope
- Triggers fallback to prompting after N denials
- Prevents breach-of-trust escalation

---

## 11. MCP Integration

### Overview

The MCP (Model Context Protocol) service is the largest subsystem (~12,238 lines across 30+ files in `services/mcp/`).

### Transport Types

| Transport         | Use Case                             |
| ----------------- | ------------------------------------ |
| `stdio`           | Subprocess-based (local MCP servers) |
| `sse` / `sse-ide` | Server-Sent Events                   |
| `http`            | HTTP streaming                       |
| `ws`              | WebSocket                            |
| `sdk`             | In-process Agent SDK                 |
| `claudeai-proxy`  | Claude.ai cloud proxy                |

### Key Components

**`client.ts`** (~3,348 lines):

- MCP server connection management
- Tool/resource discovery and lifecycle
- Session management and OAuth token handling
- Response truncation/validation before sending to model

**`config.ts`** (~1,578 lines):

- Load configs from: local (`.mcp.json`), user (`~/.claude/mcp`), project (`.claude/mcp`), enterprise
- Environment variable expansion in configs
- OAuth credential management

**`auth.ts`** (~2,465 lines):

- OAuth token lifecycle (refresh, cache, revocation)
- Cross-App Access (XAA) for multi-tenant
- ClaudeAI OAuth bridge
- 15-min auth state cache

**`useManageMCPConnections.ts`** (~1,141 lines):

- React hook for connection lifecycle
- Auto-discovery and connection
- Error recovery and reconnection
- Batched concurrent connections via `pMap`

### Agent-Specific MCP

Agents can declare MCP servers:

```typescript
type AgentMcpServerSpec =
  | string // Reference shared server
  | { [name: string]: McpServerConfig }; // Inline definition

// Shared (string refs) → reused from parent
// Inline (object specs) → cleaned up on agent finish
```

### Data Flow

```
MCP Server Config → Transport Creation → Tool Discovery →
Tool Caching → Tool Invocation → Result Validation → Model
```

---

## 12. Memory System

### Architecture

File-based, markdown-centric persistent memory in `memdir/`.

**Directory structure:**

```
~/.claude/projects/<slug>/memory/
├── MEMORY.md              # Index (max 200 lines / 25KB)
├── user_role.md           # User profile
├── feedback_testing.md    # Behavioral guidance
├── project_deadline.md    # Project context
├── reference_dashboards.md # External pointers
└── team/                  # Team memory (if TEAMMEM enabled)
    └── shared_decisions.md
```

### Memory Types (4-type taxonomy)

| Type        | Purpose                                            | Scope           |
| ----------- | -------------------------------------------------- | --------------- |
| `user`      | Role, preferences, knowledge level                 | Always private  |
| `feedback`  | How to approach work (corrections + confirmations) | Private or team |
| `project`   | Ongoing work, goals, deadlines, incidents          | Team-preferred  |
| `reference` | External system pointers (Slack, Linear, etc.)     | Team-preferred  |

### Memory File Format

```markdown
---
name: { { memory name } }
description: { { one-line hook } }
type: { { user | feedback | project | reference } }
---

{{memory content}}
```

### Memory Modes

1. **Individual** (default): Single `memory/` directory, model can freely read/write
2. **Combined** (feature `TEAMMEM`): Private (`memory/`) + Team (`memory/team/`) with different constraints
3. **Assistant** (feature `KAIROS`): Append-only daily logs (`memory/logs/YYYY/MM/DD.md`), nightly `/dream` distillation

### What NOT to Save

- Code patterns, architecture, file structure (derivable from code)
- Git history (use `git log`)
- Ephemeral task details (use TodoWrite instead)
- Anything already in CLAUDE.md files
- Debugging solutions (the fix is in the code)

### Recall Safety

> "Memory records can become stale. Before using memory to answer, verify it's still correct by reading current state. Trust current observation over stale memory."

### Entry Truncation

- Line limit: 200 lines
- Byte limit: 25 KB
- Truncates at newline if byte cap triggers
- Appends warning if either fired

---

## 13. Skills System

### Two-Tier System

1. **Bundled skills** — compiled into the binary
2. **Disk-based skills** — loaded from markdown files

### Bundled Skills (`skills/bundledSkills.ts`)

```typescript
type BundledSkillDefinition = {
  name: string;
  description: string;
  aliases?: string[];
  whenToUse?: string;
  argumentHint?: string;
  allowedTools?: string[];
  model?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  context?: 'inline' | 'fork';
  agent?: string;
  files?: Record<string, string>; // Embedded reference files
  getPromptForCommand: (args, context) => Promise<ContentBlockParam[]>;
};
```

**Built-in skills:** `batch`, `claudeApi`, `loop`, `schedule`, `simplify`, `skillify`, `stuck`, `verify`, `updateConfig`, `keybindings`

### Disk-Based Skills (`skills/loadSkillsDir.ts`)

**Load sources (priority order):**

1. Bundled (always available)
2. Managed (from policy directory)
3. Plugin (from plugins)
4. Project (`.claude/skills/`)
5. User (`~/.claude/skills/`)

**Skill file format:**

```markdown
---
name: my-skill
description: What it does
aliases: [ms, shortname]
whenToUse: When to invoke this
argumentHint: '[options]'
allowedTools: [FileRead, FileWrite, FileEdit, Bash, Glob]
model: claude-3-5-haiku
hooks:
  SessionStart:
    matcher: 'some-condition'
    shell: echo "Hello"
---

# Skill prompt content

This is the actual prompt sent to the model when invoked via /my-skill.
```

**Lazy loading:** Full prompt only loaded on invocation — token count estimated from frontmatter alone.

---

## 14. Hooks System

### Overview

76+ hook files in `hooks/`. Hooks are reactive patterns for UI state changes, permission flows, background tasks, MCP connections, and IDE sync.

### Hook Events

| Event                | When                                     |
| -------------------- | ---------------------------------------- |
| `Setup`              | Session initialization                   |
| `SessionStart`       | Session ready                            |
| `PreToolUse`         | Before tool execution (permission point) |
| `PostToolUse`        | After tool execution                     |
| `PostToolUseFailure` | Tool failed                              |
| `UserPromptSubmit`   | User message submitted                   |
| `FileChanged`        | File system watch notification           |
| `CwdChanged`         | Working directory changed                |
| `PermissionRequest`  | Permission dialog shown                  |
| `PermissionDenied`   | Permission denied                        |
| `Notification`       | Task completion                          |

### Hook Response Schema

```typescript
{
  continue?: boolean           // Should continue (default true)
  suppressOutput?: boolean     // Hide from transcript
  stopReason?: string          // Reason if continue=false
  decision?: 'approve' | 'block'  // Permission decision
  hookSpecificOutput?: {...}   // Type-specific payload
}
```

### Hook Registration

```typescript
type HookCallback = {
  type: 'callback';
  callback: (input, toolUseID, abort, hookIndex?, context?) => Promise<HookJSONOutput>;
  timeout?: number;
  internal?: boolean; // Excluded from metrics
};
```

### Notable Hooks

| Hook                | Purpose                           |
| ------------------- | --------------------------------- |
| `useCanUseTool`     | Permission checking (interceptor) |
| `useCommandQueue`   | Batch incoming prompts            |
| `useHistorySearch`  | Full-text transcript search       |
| `useRemoteSession`  | CCR communication                 |
| `useScheduledTasks` | Cron task polling                 |
| `useSkillsChange`   | Reload skills on file changes     |
| `useSettingsChange` | Reload settings on file changes   |
| `useVoice`          | Voice input/output                |
| `useCostSummary`    | Exit handler for cost display     |

---

## 15. Configuration System

### Three-Tier Hierarchy

Applied in order (later overrides earlier):

1. **User settings** (`~/.claude/settings.json`) — persistent user preferences
2. **Project settings** (`.claude/settings.json`) — project-specific overrides
3. **Managed settings** (remote or MDM) — organization policy

### Key Types

```typescript
type GlobalConfig = {
  projects?: Record<string, ProjectConfig>
  numStartups: number
  installMethod?: 'local' | 'native' | 'global' | 'unknown'
  autoUpdates?: boolean
  theme: ThemeSetting
  hasCompletedOnboarding?: boolean
}

type ProjectConfig = {
  allowedTools: string[]
  mcpContextUris: string[]
  mcpServers?: Record<string, McpServerConfig>
  lastCost?, lastAPIDuration?, lastDuration?
  hasTrustDialogAccepted?: boolean
  activeWorktreeSession?: { ... }
}

type SettingsJson = {
  apiKeyHelper?: string
  modelSetting?: ModelSetting
  theme?: ThemeSetting
  editorMode?: EditorMode
  outputStyle?: OutputStyle
  mcpServers?: Record<string, McpServerConfig>
  bypassPermissionsAccepted?: boolean
  autoCompactDisabled?: boolean
  planMode?: boolean
}
```

### Setting Sources

```typescript
type SettingSource =
  | 'userSettings' // ~/.claude/settings.json
  | 'projectSettings' // .claude/settings.json
  | 'remoteManagedSettings' // Fetched from Anthropic
  | 'policySettings'; // Organization MDM policy
```

### Loading Flow

```
enableConfigs()       → validate JSON, set up file watchers
getGlobalConfig()     → memoized read of ~/.claude/config.json
getCurrentProjectConfig() → merge user + project + managed settings
```

---

## 16. Cost Tracking

### Cost State (`cost-tracker.ts`)

```typescript
type StoredCostState = {
  totalCostUSD: number;
  totalAPIDuration: number;
  totalAPIDurationWithoutRetries: number;
  totalToolDuration: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  modelUsage: {
    [modelName: string]: {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      webSearchRequests: number;
      costUSD: number;
      contextWindow: number;
      maxOutputTokens: number;
    };
  };
};
```

### Cost Accumulation

```
API response received
    │
    ▼
Extract usage from response
    │
    ▼
calculateUSDCost(model, usage)
    │
    ▼
Update per-model totals
    │
    ▼
Post to telemetry counters (costCounter, tokenCounter)
    │
    ▼
Recursively add advisor usage if present
```

### Cross-Session Persistence

```
getCurrentProjectConfig()
    → { lastCost, lastAPIDuration, lastSessionId }

getStoredSessionCosts(sessionId)
    → only if sessionId matches last saved

restoreCostStateForSession(sessionId)
    → setCostStateForRestore(data)

saveCurrentSessionCosts(fpsMetrics?)
    → persist to project config
```

### Display Format

```
Total cost:            $X.XX
Total duration (API):  XXXms
Total duration (wall): XXms
Total code changes:    NN lines added, MM lines removed
Usage by model:
  claude-opus-4-6:     XXXXXX input, XXXXXX output ($X.XX)
  claude-haiku-4-5:    ...
```

---

## 17. Bridge & Remote Execution

### Bridge System (`bridge/`)

Connects CLI to a remote bridge server for environment-specific execution (containers, VMs, air-gapped networks).

**Key components:**

| File                     | Purpose                           |
| ------------------------ | --------------------------------- |
| `bridgeApi.ts`           | HTTP client for bridge REST API   |
| `bridgeMain.ts` (~115KB) | Full bridge session orchestration |
| `createSession.ts`       | Session creation protocol         |

**Features:**

- OAuth token refresh on 401
- Trusted device token support (SecurityTier=ELEVATED)
- Exponential backoff retry
- Permission request/response relay
- Tool result streaming
- Session state recovery

**Data flow:**

```
User Input (CLI)
    → bridgeApi (serialize)
    → Bridge Server (process)
    → Response
    → Tool Results (persist + stream)
    → Model Output
```

### Remote Session Manager (`remote/RemoteSessionManager.ts`)

Manages WebSocket connection to remote CCR session:

```
RemoteSessionManager created
    │
    ▼
connect() → WebSocket established
    │
    ▼
handleMessage(SDKMessage) → dispatch to callback
handleMessage(PermissionRequest) → store in pending map
    │
    ▼
sendPermissionResponse() → POST back to remote
    │
    ▼
onDisconnected/onError → auto-reconnect with backoff (max 60s)
```

---

## 18. Key Design Patterns

### 1. Feature Gating (Dead Code Elimination)

```typescript
const Module = feature('FEATURE_FLAG') ? require('./module.js') : null;
// Bundler elides null branches, shrinks production build
```

Used for: ant-only features, experimental features, platform-specific code.

### 2. Lazy Loading

```typescript
const getModule = () => require('./module.js');
// Called only when needed, avoiding circular deps
```

Heavy modules (OpenTelemetry, React) loaded on first use.

### 3. System Prompt Section Caching

Cached sections preserve prompt prefix across turns, enabling multi-turn API cache hits. `DANGEROUS_uncachedSystemPromptSection()` explicitly documents cache-breaking.

### 4. Async Generators for Streaming

```typescript
async function* query(params): AsyncGenerator<StreamEvent | Message, Terminal>
```

The query loop, tool executors, and message handlers all use generators for incremental output.

### 5. Immutable State with Mutable Store

```typescript
type AppState = DeepImmutable<{ ... }>
store.setState(prev => ({ ...prev, field: newValue }))
```

State is conceptually immutable; updates via pure functions prevent accidental mutation.

### 6. Circuit Breakers

Auto-compact has a consecutive failure counter (stops after 3):

```typescript
if (consecutiveFailures >= 3) {
  // Circuit breaker: stop retrying compaction
}
```

Prevents infinite retry loops on pathological inputs.

### 7. Discriminated Unions

```typescript
type Message = UserMessage | AssistantMessage | SystemMessage | ...
// Pattern matching on `type` field
```

### 8. Context Modifier Chain

```typescript
type ToolResult = {
  data: T;
  contextModifier?: (ctx: ToolUseContext) => ToolUseContext;
};
// Non-concurrent tools can modify global context
// Collected and applied after execution
```

### 9. Task Notification Queueing

```typescript
enqueueAgentNotification({ taskId, status, error, usage });
// Atomically marks task notified (prevents duplicates)
// Aborts speculation (stale task output)
// Enqueues XML block for model consumption
```

### 10. MCP Tool Deduplication

```typescript
assembleToolPool(permissionContext, mcpTools) {
  // Built-ins sorted first → stable cache
  // MCP tools preserve discovery order
  // Built-ins win on name conflict
  return uniqBy([...builtIn, ...mcp], 'name')
}
```

### 11. Fork Subagent Cache Optimization

Fork children inherit parent's frozen system prompt for prompt cache hits. Uses placeholder results to maintain cache-identical prefixes.

### 12. Per-Turn vs Session-Wide State

| Scope          | Examples                                                 | Reset                              |
| -------------- | -------------------------------------------------------- | ---------------------------------- |
| Per-turn       | `discoveredSkillNames`, `nestedMemoryAttachmentTriggers` | Cleared at `submitMessage()` start |
| Session-wide   | `loadedNestedMemoryPaths`, `mutableMessages`             | Persists across turns              |
| Process-global | `sessionId`, `totalCostUSD`, `registeredHooks`           | Lives in `bootstrap/state.ts`      |

---

## Appendix: Critical File Index

| File                                      | Purpose                                  |
| ----------------------------------------- | ---------------------------------------- |
| `entrypoints/cli.tsx`                     | CLI entry point, fast-path logic         |
| `entrypoints/init.ts`                     | One-time initialization system           |
| `QueryEngine.ts`                          | Per-conversation query lifecycle manager |
| `query.ts`                                | Main query loop (async generator)        |
| `Tool.ts`                                 | Tool interface + ToolUseContext types    |
| `tools.ts`                                | Tool registry and assembly               |
| `tools/AgentTool/AgentTool.tsx`           | Agent spawning tool                      |
| `tools/AgentTool/runAgent.ts`             | Agent execution (~1000 lines)            |
| `tools/AgentTool/loadAgentsDir.ts`        | Agent definition loading                 |
| `tools/AgentTool/builtInAgents.ts`        | Built-in agent definitions               |
| `tools/SendMessageTool/`                  | Inter-agent communication                |
| `tasks/LocalAgentTask/`                   | Background agent task lifecycle          |
| `tasks/RemoteAgentTask/`                  | Remote CCR task lifecycle                |
| `tasks/InProcessTeammateTask/`            | Multi-agent swarm tasks                  |
| `coordinator/coordinatorMode.ts`          | Multi-agent orchestration                |
| `state/AppStateStore.ts`                  | Core mutable application state           |
| `bootstrap/state.ts`                      | Global session state (~56KB)             |
| `context.ts`                              | System prompt + context assembly         |
| `constants/systemPromptSections.ts`       | Prompt section caching                   |
| `services/compact/autoCompact.ts`         | Auto-compaction thresholds               |
| `services/compact/compact.ts`             | Compaction implementation                |
| `services/mcp/client.ts`                  | MCP client (~3,348 lines)                |
| `services/mcp/config.ts`                  | MCP config loading (~1,578 lines)        |
| `services/mcp/auth.ts`                    | MCP OAuth (~2,465 lines)                 |
| `services/tools/StreamingToolExecutor.ts` | Concurrent tool execution                |
| `permissions/PermissionMode.ts`           | Permission mode types                    |
| `permissions/permissionSetup.ts`          | Permission initialization                |
| `memdir/memdir.ts`                        | Persistent memory system                 |
| `skills/bundledSkills.ts`                 | Compiled-in skills                       |
| `skills/loadSkillsDir.ts`                 | Disk-based skill loading                 |
| `hooks/`                                  | 76+ reactive hook files                  |
| `utils/config.ts`                         | Configuration hierarchy                  |
| `cost-tracker.ts`                         | Token/dollar accounting                  |
| `bridge/bridgeApi.ts`                     | Bridge server HTTP client                |
| `remote/RemoteSessionManager.ts`          | Remote session WebSocket                 |
| `main.tsx`                                | REPL bootstrap                           |

---

## 19. Comparative Analysis: Lessons for the Study Abroad Platform

> This section analyzes what patterns from Claude Code have reference value for the study-abroad-platform's runtime AI agent system (`apps/api/src/modules/ai-agent/`).
>
> **Principle**: Borrow **state machines and budget strategies**, NOT local-file/CLI/desktop interaction patterns. This is a server-side multi-tenant system.

### 19.1 Architecture Comparison Overview

| Dimension                   | Study Abroad Platform                                 | Claude Code                                                    | Verdict                                                          |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Workflow model**          | ReWOO (Plan → Execute → Solve)                        | ReAct (API → tools → loop)                                     | Keep ReWOO — bounded LLM calls, predictable cost                 |
| **Routing**                 | 3-tier (Keyword → Embedding → LLM)                    | LLM-only                                                       | Keep 3-tier — latency advantage                                  |
| **Memory**                  | Redis + PostgreSQL + pgvector                         | File-based markdown                                            | Keep enterprise memory — multi-user production                   |
| **Tool concurrency**        | Binary readonly/mutable split via `TOOL_READONLY` set | Per-invocation `isConcurrencySafe(input)`, fail-closed default | **Fix** — current classification has concurrency semantic errors |
| **Prompt caching**          | Rebuild every request                                 | Section caching (cache-safe vs cache-breaking)                 | **Adopt** — high cost savings                                    |
| **Conversation compaction** | Hard `RPUSH + LTRIM 50`                               | LLM-driven summary with circuit breaker                        | **Adopt** — prevents context loss                                |
| **Token pre-check**         | `call()` has coarse check; `callStream()` has none    | Unified budget enforcement                                     | **Extend** — unify + make budget-aware                           |
| **Tool result budget**      | No aggregate limit                                    | Per-conversation budget with tombstone markers                 | **Adopt** — prevents context overflow                            |
| **Error recovery**          | Per-tool retry + circuit breaker                      | Context overflow recovery (compact + retry)                    | **Adopt** — graceful degradation                                 |
| **Task/progress tracking**  | Streaming only (lost on disconnect)                   | Full task state machine with persistence                       | Consider — borrow state model, not disk I/O                      |
| **Verification**            | Chain-of-Verification (CoVE)                          | None                                                           | Keep CoVE — domain accuracy matters                              |
| **Hallucination control**   | Domain-specific ("only cite verifiable data")         | General instruction-following                                  | Keep — more sophisticated                                        |
| **Multi-tenant quotas**     | Per-user daily/monthly limits                         | Per-session cost tracking                                      | Keep — production necessity                                      |
| **Circuit breaker**         | Redis-backed distributed (Lua atomics)                | Process-local counter                                          | Keep — multi-instance safe                                       |

### 19.2 What the Platform Does Better (Preserve)

1. **ReWOO workflow** — Exactly 2-3 LLM calls per turn (Plan + Solve + optional CoVE) vs Claude Code's unbounded loop. For a SaaS product with per-request cost sensitivity, this is the right trade-off.

2. **3-tier routing** — FastRouter (keyword, ~0ms) → EmbeddingRouter (semantic, ~5ms) → LLM Orchestrator (~1-3s) avoids LLM calls for common patterns. Claude Code always goes through the LLM.

3. **Enterprise memory** — Redis + PostgreSQL + pgvector with decay, compaction, conflict detection, and embedding-based retrieval is far more sophisticated than file-based markdown. Designed for multi-user, multi-session production use.

4. **Chain-of-Verification** — Cross-checks the Solve output against tool results and re-solves on inaccuracies. Essential for school recommendation accuracy where hallucinated statistics could mislead users.

5. **Bilingual prompts** — Full zh/en parity with locale-aware output. `buildXxxSystemPrompt(locale)` / `buildXxxUserPrompt(data, locale)` is cleaner than Claude Code's English-only approach.

6. **Typed JSON extraction** — `extractJsonFromLlm<T>()` with generics vs Claude Code's XML tag extraction without schema validation.

7. **Distributed circuit breaker** — Redis-backed with Lua script atomics and in-memory fallback vs Claude Code's process-local counter. Essential for multi-instance deployments.

### 19.3 Five Source Code Patterns Worth Directly Adopting as Guardrails

These are not "ideas for inspiration" — they are concrete implementation patterns from Claude Code that can be translated into enforceable rules for the platform.

#### Pattern 1: System Prompt Section Caching (cache-safe vs cache-breaking)

**Source**: `claude-code/constants/systemPromptSections.ts` L17-37

Claude Code explicitly separates system prompt sections into two categories:

```typescript
// Cache-safe: computed once, cached until /clear or /compact
systemPromptSection(name, compute); // cacheBreak: false

// Cache-breaking: recomputes every turn, WILL break prompt cache
DANGEROUS_uncachedSystemPromptSection(name, compute, reason); // cacheBreak: true
```

Sections are resolved in parallel via `resolveSystemPromptSections()`, with a `Map` cache in bootstrap state. The `DANGEROUS_` prefix forces developers to justify cache-breaking with a `_reason` string.

**Why this matters**: OpenAI and Anthropic APIs support prefix-based prompt caching. A stable prefix means subsequent requests reuse cached computations (50-90% cost reduction on cache hits). Currently `getLocalizedSystemPrompt()` at `agents.config.ts` L516 rebuilds the full string every call, and `buildPlanPrompt` in `workflow-engine.service.ts` interleaves dynamic user context into the middle — both break any potential cache.

**Guardrail**: Split agent system prompts into static prefix (agent personality, tool instructions, output format) and dynamic suffix (user profile summary, memory context, date). Cache the prefix per `(agentType, locale)`. Never prepend or interleave dynamic content into the static prefix.

- **Files**: `agents.config.ts` L516-526, `workflow-engine.service.ts` L1283+

#### Pattern 2: Tool Result Aggregate Budget with Stable Replay

**Source**: `claude-code/utils/toolResultStorage.ts` L769+

Claude Code doesn't just truncate individual tool results — it tracks an **aggregate token budget** across all tool results in a conversation. When the budget is exceeded:

1. The oldest/largest tool results are replaced with tombstone markers
2. The replacement is **stable** — subsequent replays of the same conversation produce identical tombstones (no non-determinism)
3. Budget is per-conversation, not per-turn

This is fundamentally different from the platform's current approach of `JSON.stringify(result.result)` with no size awareness at `workflow-engine.service.ts` L742.

**Why this matters**: In the Solve phase, 5-6 parallel readonly tools can accumulate 15,000-30,000 tokens of raw JSON tool results. This directly inflates Solve-phase LLM cost and risks context overflow.

**Guardrail**: Implement a `ToolResultBudget` that:

- Accepts a per-workflow token budget (e.g., 8,000 tokens for tool results)
- Tracks cumulative token consumption as tool results arrive
- Replaces oversized results with structured summaries (e.g., "Found 47 schools, top 10 shown: [...]")
- Preserves result ordering for deterministic Solve prompts

#### Pattern 3: Context Overflow Recovery (compact + retry, not 400)

**Source**: `claude-code/services/compact/compact.ts` L450+

When even compaction itself exceeds context, Claude Code:

1. Strips images/documents from messages
2. Trims the oldest turns
3. Retries compaction with reduced input
4. Only fails after exhausting recovery options

The platform currently throws a hard 400 at `llm.service.ts` L140-148:

```typescript
throw new HttpException({ code: 'CONTEXT_WINDOW_EXCEEDED' }, 400);
```

And `callStream()` at L205 has **no pre-check at all** — it hits the provider directly and yields an error chunk on failure.

**Guardrail**: Unify the pre-flight check across `call()` and `callStream()`. On overflow:

1. First attempt: trigger conversation compaction (summarize older messages) and retry
2. Second attempt: truncate tool results and retry
3. Only throw 400 after recovery attempts are exhausted

- **Files**: `llm.service.ts` L120-149 (existing check in `call()`), L205-224 (missing check in `callStream()`)

#### Pattern 4: Task State Machine for Reconnection

**Source**: `claude-code/Task.ts` L44+

Claude Code models every background operation as a state machine:

```typescript
type TaskStateBase = {
  id: string; // Prefix + 8-char random
  type: TaskType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
  outputFile: string; // Disk output path
  outputOffset: number; // Incremental read position
  notified: boolean; // Completion notification sent?
};
```

Key properties: `outputOffset` enables incremental reads (client can resume from last position), `notified` prevents duplicate notifications.

**What to borrow**: The state model and offset tracking, NOT the disk I/O or CLI rendering. For the platform:

- Store task state in Redis with TTL (not disk)
- `outputOffset` becomes a WebSocket event sequence number
- `notified` becomes a flag for push notification dedup
- Expose `GET /chat/tasks/:taskId/status` for reconnection polling

**Guardrail**: When a user disconnects during a long-running agent workflow (e.g., `analyze_admission_chance` taking 15s), the task continues server-side. On reconnect, the client polls task status and resumes streaming from the last acknowledged event offset.

#### Pattern 5: Per-Tool Concurrency Trait (fail-closed default)

**Source**: `claude-code/Tool.ts` L749-760

Claude Code's `buildTool()` sets **fail-closed defaults**:

```typescript
const TOOL_DEFAULTS = {
  isConcurrencySafe: (_input?) => false, // Assume NOT safe
  isReadOnly: (_input?) => false, // Assume writes
  isDestructive: (_input?) => false,
};
```

Each tool **self-declares** its concurrency safety. The default is "not safe" — a tool must explicitly opt in to parallel execution. And the check is **per-invocation** (receives `input`), not per-tool-name.

The platform's `TOOL_READONLY` set at `tools.config.ts` L95 is the opposite pattern:

- A centralized constant guesses which tools are safe based on **name prefix** (`get_`, `search_`, `review_`, etc.)
- The classification is **wrong** for several tools:
  - `REVIEW_ESSAY` — delegates to `EssayAiService` which "charges points → calls AI → persists EssayAIResult → records memory" (per `essay-tools.service.ts` L6-7)
  - `RECOMMEND_SCHOOLS` — delegates to `RecommendationService` which "charges points → AI ranking → probability calibration → persists → memory" (per `recommendation-tools.service.ts` L6-7)
  - `ANALYZE_ADMISSION_CHANCE` — delegates to `PredictionService` which persists results
  - `ANSWER_FORUM_QUESTION` — may create forum content
- These are **concurrency semantic errors**, not optimization items. If two of these tools run in parallel (via `Promise.allSettled`), they can double-charge points or create duplicate persisted results.

**Guardrail**: Move concurrency declaration to where the knowledge lives — each `IToolHandlerProvider`:

```typescript
interface IToolHandlerProvider {
  getHandlers(): Map<string, ToolHandler>;
  getReadonlyTools?(): Set<string>; // Self-declared, fail-closed default
}
```

Unlisted tools default to mutable (sequential). The centralized `TOOL_READONLY` constant is removed. This is the same pattern as Claude Code's `isConcurrencySafe` default being `false`.

- **Files**: `tools.config.ts` L95-144, `tool-handler.interface.ts`, all `*-tools.service.ts`

### 19.4 Corrected Priority Order

```
P0 — Concurrency & Resilience (immediate, prevents bugs):
├── TOOL_READONLY audit & fix: move REVIEW_ESSAY, RECOMMEND_SCHOOLS,
│   ANALYZE_ADMISSION_CHANCE, ANSWER_FORUM_QUESTION out of readonly set.
│   Longer-term: migrate to per-provider self-declaration.
│   [tools.config.ts L95] [essay-tools.service.ts L6] [recommendation-tools.service.ts L6]
│
└── Add 30% random jitter to retry delay in ResilienceService.
    [resilience.service.ts withRetry()]

P0/P1 — Token Guard Unification:
└── Extend the coarse pre-flight check from call() to callStream().
    Make recommendation/prediction prompt field truncation budget-driven
    (not fixed slice). The gap is not "no check exists" but "callStream()
    has zero protection and domain prompts use fixed truncation".
    [llm.service.ts L120 vs L205]

P1 — Prompt & Token Efficiency:
├── System prompt static prefix caching per (agentType, locale).
│   Cache static portion only; date, user summary, memory context
│   are dynamic suffix — never interleave them into the prefix.
│   [agents.config.ts L516] [workflow-engine.service.ts L1283]
│
└── Tool result aggregate budget with structured summarization
    for oversized results (not just JSON.stringify pass-through).
    [workflow-engine.service.ts L742]

P1/P2 — Context & Recovery:
├── Conversation compaction: LLM-summarize old messages instead of
│   RPUSH + LTRIM 50. Use existing SummarizerService.
│   [redis-cache.service.ts L55]
│
└── Context overflow recovery: compact + retry before throwing 400.
    [llm.service.ts L140-148]

P2 — UX Polish:
└── Lightweight Redis task registry for disconnect/reconnect scenarios.
    Borrow Task.ts state model (id, status, offset, notified),
    NOT disk persistence or CLI rendering.
```

### 19.5 Patterns NOT Worth Adopting

| Claude Code Pattern                             | Why Not Applicable                                                                                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ReAct loop                                      | ReWOO is more cost-efficient for structured tool patterns                                                                                                                                                                                     |
| File-based markdown memory                      | Enterprise Redis/PG/pgvector is superior for multi-user                                                                                                                                                                                       |
| Permission system (7 modes)                     | Server-side API uses role-based auth, not interactive permissions                                                                                                                                                                             |
| Deferred tool loading (ToolSearch)              | Agent tool filtering already handles this adequately                                                                                                                                                                                          |
| Fork subagent cache optimization                | Single-process server, not a CLI with subprocesses                                                                                                                                                                                            |
| MCP integration                                 | Custom tool services are tighter coupled and more efficient                                                                                                                                                                                   |
| Hooks system                                    | NestJS interceptors/guards/pipes serve the same purpose                                                                                                                                                                                       |
| Coordinator mode                                | Orchestrator + specialists already handle multi-agent                                                                                                                                                                                         |
| Disk-based task output                          | Redis + WebSocket is the right medium for server-side                                                                                                                                                                                         |
| Sibling abort (`siblingAbortController`)        | `Promise.allSettled` is correct for ReWOO — Solve phase benefits from partial results even on failure. Exception: short-circuit Solve only when **all** tools fail                                                                            |
| Workflow-level circuit breaker (as direct copy) | Claude Code's evidence is autocompact/transport-layer breakers, not a full turn-level provider outage breaker. The direction is valid but should be designed as an extension of the existing `ResilienceService`, not copied from Claude Code |

### 19.6 Evidence Strength Assessment

| Recommendation             | Claude Code Evidence                                                                          | Confidence                 |
| -------------------------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| Prompt section caching     | **Strong** — explicit `systemPromptSection()` + `DANGEROUS_uncached` with `_reason` param     | Direct adoption            |
| Tool result budget         | **Strong** — `toolResultStorage.ts` with aggregate budget + tombstone markers + stable replay | Direct adoption            |
| Context overflow recovery  | **Strong** — `compact.ts` with multi-step fallback (strip images → trim turns → retry)        | Direct adoption            |
| Task state machine         | **Strong** — `Task.ts` with `id/status/offset/notified` model                                 | Borrow model, adapt medium |
| Per-tool concurrency trait | **Strong** — `buildTool()` fail-closed defaults, per-invocation `isConcurrencySafe(input)`    | Direct adoption            |
| Retry jitter               | **Moderate** — general best practice, not uniquely from Claude Code                           | Standard engineering       |
| Workflow circuit breaker   | **Weak** — Claude Code has autocompact breaker (3 failures), not a general workflow breaker   | Own design extension       |
| Sibling abort              | **Weak** — exists in `StreamingToolExecutor` but wrong fit for ReWOO's `Promise.allSettled`   | Do not adopt               |
