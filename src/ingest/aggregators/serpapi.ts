/**
 * SerpApi Google Jobs Aggregator Connector
 *
 * Connects directly to SerpApi's Google Jobs engine:
 * https://serpapi.com/search.json?engine=google_jobs
 *
 * Aggregates live job postings indexed by Google across LinkedIn, Indeed,
 * Naukri, Glassdoor, and corporate career pages.
 */

export interface GoogleJobItem {
  title: string;
  company_name: string;
  location: string;
  description: string;
  apply_url: string;
  via?: string;
  salary?: string;
  job_id: string;
  workplaceType?: 'remote' | 'hybrid' | 'onsite';
}

export async function searchGoogleJobs(params: {
  query: string;
  location?: string;
  apiKey?: string;
  limit?: number;
}): Promise<{ success: boolean; jobs: GoogleJobItem[]; error?: string }> {
  const apiKey = params.apiKey || process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      jobs: [],
      error: 'SERPAPI_API_KEY is not configured in .env. Please set SERPAPI_API_KEY to fetch live Google Jobs.',
    };
  }

  const query = params.query.trim();
  const location = params.location || 'India';
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_jobs');
  url.searchParams.set('q', query);
  url.searchParams.set('location', location);
  url.searchParams.set('api_key', apiKey);

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MyJobApply-Crawler/1.0' },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, jobs: [], error: `SerpApi returned HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json() as any;
    const rawList = data.jobs_results || [];

    const jobs: GoogleJobItem[] = [];
    const maxItems = params.limit || 15;

    for (const item of rawList.slice(0, maxItems)) {
      // Find the best direct apply link
      const directOption = (item.apply_options || []).find((opt: any) =>
        opt.link && !opt.link.includes('google.com')
      );
      const applyUrl = directOption?.link || item.share_link || (item.apply_options?.[0]?.link) || '';

      if (!applyUrl || !item.title || !item.company_name) continue;

      let workplaceType: 'remote' | 'hybrid' | 'onsite' = 'onsite';
      const locText = (item.location || '').toLowerCase();
      const titleText = (item.title || '').toLowerCase();
      if (locText.includes('remote') || titleText.includes('remote')) {
        workplaceType = 'remote';
      } else if (locText.includes('hybrid') || titleText.includes('hybrid')) {
        workplaceType = 'hybrid';
      }

      jobs.push({
        title: item.title,
        company_name: item.company_name,
        location: item.location || location,
        description: item.description || '',
        apply_url: applyUrl,
        via: item.via || '',
        salary: item.detected_extensions?.salary || 'Competitive',
        job_id: item.job_id || `google-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        workplaceType,
      });
    }

    return { success: true, jobs };
  } catch (err: any) {
    return { success: false, jobs: [], error: err.message || 'Failed to query SerpApi' };
  }
}
