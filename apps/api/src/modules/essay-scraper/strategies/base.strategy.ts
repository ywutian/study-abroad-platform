import { Logger, BadRequestException } from '@nestjs/common';
import { SourceType } from '../../../common/types/enums';
import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Check if an IP address belongs to a private/reserved network range.
 * Blocks SSRF attacks by preventing requests to internal infrastructure.
 */
function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1') return true;

  // IPv6 private (fc00::/7)
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true;
  }

  // IPv4 checks
  if (!net.isIPv4(ip)) return false;

  const parts = ip.split('.').map(Number);
  const [a, b] = parts;

  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 10.0.0.0/8 — private
  if (a === 10) return true;
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 — link-local
  if (a === 169 && b === 254) return true;
  // 0.0.0.0
  if (a === 0) return true;

  return false;
}

/**
 * Validate that a URL does not resolve to a private/internal IP address.
 * Prevents SSRF attacks.
 */
async function validateUrlNotPrivate(url: string): Promise<void> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  // If the hostname is already an IP, check it directly
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new BadRequestException(
        `SSRF blocked: URL resolves to a private IP address`,
      );
    }
    return;
  }

  // Resolve hostname to IP and check
  try {
    const { address } = await dnsLookup(hostname);
    if (isPrivateIP(address)) {
      throw new BadRequestException(
        `SSRF blocked: URL resolves to a private IP address`,
      );
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(
      `SSRF validation failed: unable to resolve hostname "${hostname}"`,
    );
  }
}

export interface ScrapedEssay {
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  type?: string;
  isRequired?: boolean;
  confidence?: number;
}

export interface ScrapeResult {
  schoolName: string;
  year: number;
  essays: ScrapedEssay[];
  sourceUrl: string;
  rawContent?: string;
}

export abstract class BaseScrapeStrategy {
  protected readonly logger: Logger;
  protected readonly REQUEST_DELAY = 2000;

  constructor(name: string) {
    this.logger = new Logger(name);
  }

  abstract readonly sourceType: SourceType;
  abstract scrape(
    schoolName: string,
    year: number,
  ): Promise<ScrapeResult | null>;

  protected async fetchPage(url: string): Promise<string> {
    // SSRF protection: block requests to private/internal IPs
    await validateUrlNotPrivate(url);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected extractWordLimit(text: string): number | undefined {
    const patterns = [
      /(\d+)\s*words?/i,
      /(\d+)\s*word\s*limit/i,
      /limit[:\s]*(\d+)/i,
      /maximum[:\s]*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return undefined;
  }

  protected classifyEssayType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (
      lowerPrompt.includes('why') &&
      (lowerPrompt.includes('college') ||
        lowerPrompt.includes('university') ||
        lowerPrompt.includes('school'))
    ) {
      return 'WHY_SCHOOL';
    }
    if (
      lowerPrompt.includes('activity') ||
      lowerPrompt.includes('extracurricular')
    ) {
      return 'ACTIVITY';
    }
    if (lowerPrompt.length < 200) {
      return 'SHORT_ANSWER';
    }
    return 'SUPPLEMENTAL';
  }
}
