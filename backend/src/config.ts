import dotenv from 'dotenv';

dotenv.config();

/**
 * Supported LLM providers for reasoning. Both are Anthropic-API compatible:
 * - `anthropic`: calls the Anthropic API directly using `ANTHROPIC_API_KEY`.
 * - `bob`: calls a Bob gateway (Anthropic-compatible) using `BOB_API_KEY` and
 *   `BOB_BASE_URL`.
 */
export type LlmProvider = 'anthropic' | 'bob';

export interface LlmConfig {
  /** Whether an LLM provider is configured and reasoning can use it. */
  enabled: boolean;
  /** Resolved provider, or `null` when no key is available. */
  provider: LlmProvider | null;
  /** API key for the resolved provider (never logged). */
  apiKey: string | null;
  /** Base URL override (required for `bob`, optional for `anthropic`). */
  baseUrl: string | null;
  /** Model id used for reasoning requests. */
  model: string;
}

export interface AwsConfig {
  /** Single region used for live inventory scans (multi-region: future work). */
  region: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  /** When true, the app serves pre-generated mock data only. */
  demoMode: boolean;
  aws: AwsConfig;
  llm: LlmConfig;
}

const DEFAULT_PORT = 3001;
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

function readString(name: string): string | null {
  const value = process.env[name];
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves which LLM provider to use. The user can explicitly select a provider
 * via `LLM_PROVIDER=bob|anthropic`, or leave it unset to auto-detect based on
 * which API key is present (Anthropic preferred when both exist).
 */
function resolveLlmConfig(): LlmConfig {
  const anthropicKey = readString('ANTHROPIC_API_KEY');
  const bobKey = readString('BOB_API_KEY');
  const bobBaseUrl = readString('BOB_BASE_URL');
  const anthropicBaseUrl = readString('ANTHROPIC_BASE_URL');
  const model = readString('LLM_MODEL') ?? DEFAULT_MODEL;

  const requested = readString('LLM_PROVIDER')?.toLowerCase() ?? null;
  if (requested && requested !== 'bob' && requested !== 'anthropic' && requested !== 'auto') {
    console.warn(
      `[config] Unknown LLM_PROVIDER "${requested}"; falling back to auto-detection.`
    );
  }

  const disabled: LlmConfig = {
    enabled: false,
    provider: null,
    apiKey: null,
    baseUrl: null,
    model,
  };

  const useBob = (): LlmConfig => {
    if (!bobKey) {
      console.warn('[config] LLM_PROVIDER=bob but BOB_API_KEY is not set; reasoning disabled.');
      return disabled;
    }
    if (!bobBaseUrl) {
      console.warn('[config] BOB_API_KEY is set but BOB_BASE_URL is not; set the Bob gateway URL.');
    }
    return { enabled: true, provider: 'bob', apiKey: bobKey, baseUrl: bobBaseUrl, model };
  };

  const useAnthropic = (): LlmConfig => {
    if (!anthropicKey) {
      console.warn(
        '[config] LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set; reasoning disabled.'
      );
      return disabled;
    }
    return {
      enabled: true,
      provider: 'anthropic',
      apiKey: anthropicKey,
      baseUrl: anthropicBaseUrl,
      model,
    };
  };

  if (requested === 'bob') {
    return useBob();
  }
  if (requested === 'anthropic') {
    return useAnthropic();
  }

  // auto-detect: prefer Anthropic, then Bob.
  if (anthropicKey) {
    return useAnthropic();
  }
  if (bobKey) {
    return useBob();
  }
  return disabled;
}

function resolveConfig(): AppConfig {
  const portValue = Number(process.env.PORT);
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : DEFAULT_PORT;

  return {
    port,
    nodeEnv: readString('NODE_ENV') ?? 'development',
    demoMode: process.env.DEMO_MODE === 'true',
    aws: {
      region: readString('AWS_REGION') ?? DEFAULT_REGION,
    },
    llm: resolveLlmConfig(),
  };
}

export const config: AppConfig = resolveConfig();
