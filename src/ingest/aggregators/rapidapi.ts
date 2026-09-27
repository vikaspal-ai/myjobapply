/**
 * Indeed12 + JSearch (RapidAPI) Job Aggregator Connector
 *
 * indeed12.p.rapidapi.com — Real Indian Indeed postings with salary data
 * jsearch.p.rapidapi.com  — JSearch multi-source (LinkedIn, Indeed, Glassdoor, etc.)
 */

export interface RapidJobItem {
  title: string;
  company_name: string;
  company_domain?: string;
  location: string;
  description: string;
  apply_url: string;
  salary?: string;
  job_id: string;
  workplaceType: 'remote' | 'hybrid' | 'onsite';
  requiredSkills: string[];
  source_platform?: string;
}

export async function searchRapidJobs(params: {
  query: string;
  location?: string;
  apiKey?: string;
  limit?: number;
}): Promise<{ success: boolean; jobs: RapidJobItem[]; error?: string }> {
  const apiKey = params.apiKey || process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return {
      success: false,
      jobs: [],
      error: 'RAPIDAPI_KEY is not configured in .env.',
    };
  }

  const maxItems = params.limit || 15;
  const allJobs: RapidJobItem[] = [];

  // ── 1. Indeed12 (India-specific, has real salary data) ─────────────────────
  try {
    const indeedUrl = new URL('https://indeed12.p.rapidapi.com/jobs/search');
    indeedUrl.searchParams.set('query', params.query);
    indeedUrl.searchParams.set('location', params.location || 'India');
    indeedUrl.searchParams.set('page_id', '1');
    indeedUrl.searchParams.set('locality', 'in');
    indeedUrl.searchParams.set('fromage', '30');
    indeedUrl.searchParams.set('radius', '100');
    indeedUrl.searchParams.set('sort', 'date');

    const res = await fetch(indeedUrl.toString(), {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'indeed12.p.rapidapi.com' },
    });

    if (res.ok) {
      const data = await res.json() as any;
      const hits: any[] = data.hits || [];

      // Fetch apply URLs in parallel (Indeed12 needs a second call for apply link)
      const jobPromises = hits.slice(0, maxItems).map(async (item: any) => {
        try {
          let applyUrl = `https://in.indeed.com/viewjob?jk=${item.id}`;
          // Try to get real apply URL from detail endpoint
          const det = await fetch(`https://indeed12.p.rapidapi.com/job/${item.id}?locality=in`, {
            headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'indeed12.p.rapidapi.com' },
          });
          if (det.ok) {
            const dj = await det.json() as any;
            applyUrl = dj.apply_url || applyUrl;
          }

          const loc = item.location || params.location || 'India';
          const wt: 'remote' | 'hybrid' | 'onsite' =
            loc.toLowerCase().includes('remote') ? 'remote' :
            loc.toLowerCase().includes('hybrid') ? 'hybrid' : 'onsite';

          let salaryDisplay: string | undefined;
          if (item.salary) {
            const s = item.salary;
            if (s.min && s.max) {
              const minL = Math.round(s.min / 100000);
              const maxL = Math.round(s.max / 100000);
              salaryDisplay = `₹${minL}L – ₹${maxL}L PA`;
            }
          }

          return {
            title: item.title,
            company_name: item.company_name || 'Company',
            location: loc,
            description: '',
            apply_url: applyUrl,
            salary: salaryDisplay,
            job_id: `indeed-${item.id}`,
            workplaceType: wt,
            requiredSkills: [],
            source_platform: 'Indeed',
          } as RapidJobItem;
        } catch {
          return null;
        }
      });

      const resolved = (await Promise.all(jobPromises)).filter(Boolean) as RapidJobItem[];
      allJobs.push(...resolved);
    }
  } catch (err: any) {
    // Indeed12 failed silently — continue to JSearch
  }

  // ── 2. JSearch (multi-source aggregator) ─────────────────────────────────
  // JSearch has job-details endpoint active; use search via GET /search (they may
  // have different subscription tier endpoint)
  // Fallback: use their search with query param
  if (allJobs.length < maxItems) {
    try {
      const jsearchUrl = new URL('https://jsearch.p.rapidapi.com/search');
      jsearchUrl.searchParams.set('query', `${params.query} in ${params.location || 'India'}`);
      jsearchUrl.searchParams.set('page', '1');
      jsearchUrl.searchParams.set('num_pages', '1');
      jsearchUrl.searchParams.set('date_posted', 'month');

      const res = await fetch(jsearchUrl.toString(), {
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
      });

      if (res.ok) {
        const data = await res.json() as any;
        const rawList: any[] = data.data || [];
        const needed = maxItems - allJobs.length;

        for (const item of rawList.slice(0, needed)) {
          if (!item.job_title || !item.employer_name || !item.job_apply_link) continue;
          const locDisplay = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || params.location || 'India';
          let salary: string | undefined;
          if (item.job_min_salary && item.job_max_salary) {
            const curr = item.job_salary_currency || 'INR';
            const minK = Math.round(item.job_min_salary / 1000);
            const maxK = Math.round(item.job_max_salary / 1000);
            salary = `${curr} ${minK}k–${maxK}k ${item.job_salary_period || 'PA'}`;
          }
          allJobs.push({
            title: item.job_title,
            company_name: item.employer_name,
            location: locDisplay,
            description: item.job_description || '',
            apply_url: item.job_apply_link,
            salary,
            job_id: item.job_id || `jsearch-${Date.now()}`,
            workplaceType: item.job_is_remote ? 'remote' : 'onsite',
            requiredSkills: item.job_required_skills || [],
            source_platform: 'JSearch',
          });
        }
      }
    } catch {
      // JSearch failed — ignore, Indeed already has results
    }
  }

  if (allJobs.length > 0) {
    return { success: true, jobs: allJobs.slice(0, maxItems) };
  }

  return {
    success: false,
    jobs: [],
    error: 'No results from Indeed12 or JSearch. Verify API subscription at rapidapi.com.',
  };
}
