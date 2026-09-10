import { describe, expect, it } from 'vitest';
import { guessCompanyName, titleCase } from './orchestrator.js';
import type { CrawledPage } from './research/crawler.js';

function homepage(title: string): CrawledPage[] {
  return [{ url: 'https://example.com/', title, text: '', sourceType: 'homepage' }];
}

describe('guessCompanyName', () => {
  it('picks the title segment matching the domain, even when the brand comes last', () => {
    // Live bug: atlassian.com's real title puts the tagline first and the brand last.
    const pages = homepage('Collaboration software for software, IT and business teams | Atlassian');
    expect(guessCompanyName('https://www.atlassian.com/', pages)).toBe('Atlassian');
  });

  it('picks the title segment matching the domain when the brand comes first', () => {
    const pages = homepage('Stripe | Payment processing platform for the internet');
    expect(guessCompanyName('https://stripe.com/', pages)).toBe('Stripe');
  });

  it('falls back to a title-cased domain slug when no title segment matches at all', () => {
    const pages = homepage('Welcome to our totally unrelated marketing headline');
    expect(guessCompanyName('https://www.acme-robotics.com/', pages)).toBe('Acme Robotics');
  });

  it('falls back to a title-cased domain slug when there is no homepage title (unreachable site)', () => {
    expect(guessCompanyName('https://www.acme-robotics.com/', [])).toBe('Acme Robotics');
  });

  it('returns the raw input when the company URL itself is unparseable', () => {
    expect(guessCompanyName('not-a-url', [])).toBe('not-a-url');
  });
});

describe('titleCase', () => {
  it('title-cases a hyphenated slug', () => {
    expect(titleCase('acme-robotics')).toBe('Acme Robotics');
  });

  it('title-cases a single word', () => {
    expect(titleCase('stripe')).toBe('Stripe');
  });
});
