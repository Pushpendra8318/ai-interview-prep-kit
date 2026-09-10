export interface PublicDiscussionResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Brave Search client for "public discussion of interview process" (brief
 * §2/§3). Optional at runtime: without SEARCH_API_KEY the pipeline honestly
 * reports "no public discussion found" rather than fabricating results or
 * failing the run.
 */
export async function searchPublicDiscussion(
  company: string,
  options: { apiKey?: string; timeoutMs: number },
): Promise<PublicDiscussionResult[]> {
  if (!options.apiKey) return [];

  const query = `${company} interview process questions glassdoor`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'X-Subscription-Token': options.apiKey },
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      web?: { results?: { title: string; url: string; description?: string }[] };
    };
    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description ?? '',
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
