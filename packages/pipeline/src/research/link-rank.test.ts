import { describe, expect, it } from 'vitest';
import { classifySource, rankLinks, scoreLink } from './link-rank.js';

describe('scoreLink', () => {
  it('scores a hiring-page link higher than a generic link', () => {
    const hiring = scoreLink({
      url: 'https://acme.example/how-we-hire',
      anchorText: 'How We Hire',
    });
    const generic = scoreLink({ url: 'https://acme.example/pricing', anchorText: 'Pricing' });
    expect(hiring).toBeGreaterThan(generic);
  });

  it('rewards keywords found in an unpredictable path, not just /careers', () => {
    // GitLab-style: hiring info lives at a handbook path, not /careers.
    const handbookPage = scoreLink({
      url: 'https://acme.example/handbook/hiring/engineering',
      anchorText: 'Engineering hiring process',
    });
    expect(handbookPage).toBeGreaterThan(0);
  });

  it('penalizes very deep paths slightly', () => {
    const shallow = scoreLink({ url: 'https://acme.example/careers', anchorText: 'careers' });
    const deep = scoreLink({
      url: 'https://acme.example/a/b/c/d/careers',
      anchorText: 'careers',
    });
    expect(deep).toBeLessThan(shallow);
  });
});

describe('rankLinks', () => {
  it('sorts by score descending and caps at maxLinks', () => {
    const links = [
      { url: 'https://acme.example/pricing', anchorText: 'Pricing' },
      { url: 'https://acme.example/careers', anchorText: 'Careers' },
      { url: 'https://acme.example/interview-process', anchorText: 'Our interview process' },
      { url: 'https://acme.example/contact', anchorText: 'Contact' },
    ];
    const ranked = rankLinks(links, { maxLinks: 2 });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.url).toContain('interview-process');
  });

  it('dedupes identical URLs (ignoring hash fragments)', () => {
    const links = [
      { url: 'https://acme.example/careers#top', anchorText: 'Careers' },
      { url: 'https://acme.example/careers', anchorText: 'Careers again' },
    ];
    const ranked = rankLinks(links, { maxLinks: 10 });
    expect(ranked).toHaveLength(1);
  });

  it('drops links that score zero (no signal at all)', () => {
    const links = [{ url: 'https://acme.example/xyz123', anchorText: 'xyz123' }];
    expect(rankLinks(links, { maxLinks: 10 })).toHaveLength(0);
  });
});

describe('classifySource', () => {
  it('classifies an interview-process page', () => {
    expect(classifySource('https://acme.example/how-we-hire/interview')).toBe('interview-process');
  });
  it('classifies a careers page', () => {
    expect(classifySource('https://acme.example/careers')).toBe('careers');
  });
  it('classifies an engineering handbook page', () => {
    expect(classifySource('https://acme.example/handbook/engineering')).toBe('engineering');
  });
  it('falls back to other', () => {
    expect(classifySource('https://acme.example/pricing')).toBe('other');
  });
});
