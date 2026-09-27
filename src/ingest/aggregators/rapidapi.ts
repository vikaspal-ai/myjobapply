/**
 * RapidAPI (JSearch / Active Jobs DB) Aggregator Connector
 *
 * Connects directly to RapidAPI's JSearch API:
 * https://jsearch.p.rapidapi.com/search
 *
 * Sourcing live postings aggregated across LinkedIn, Indeed, Glassdoor,
 * ZipRecruiter, and direct company career pages.
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
      error: 'RAPIDAPI_KEY is not configured in .env. Please set RAPIDAPI_KEY to search JSearch/RapidAPI jobs.',
    };
  }

  const queryStr = `${params.query} in ${params.location || 'India'}`;
  const maxItems = params.limit || 15;

  // Ordered list of RapidAPI endpoints to attempt — first subscribed one wins
  const endpoints = [
    {
      host: 'jsearch.p.rapidapi.com',
      url: `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(queryStr)}&page=1&num_pages=1`,
      parse: (data: any) => (data.data || []).map((item: any) => {
        if (!item.job_title || !item.employer_name || !item.job_apply_link) return null;
        const locDisplay = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || params.location || 'India';
        let salaryDisplay: string | undefined;
        if (item.job_min_salary && item.job_max_salary) {
          const curr = item.job_salary_currency || 'INR';
          const minK = Math.round(item.job_min_salary / 1000);
          const maxK = Math.round(item.job_max_salary / 1000);
          salaryDisplay = `${curr} ${minK}k–${maxK}k ${item.job_salary_period || 'PA'}`;
        }
        return {
          title: item.job_title,
          company_name: item.employer_name,
          location: locDisplay,
          description: item.job_description || '',
          apply_url: item.job_apply_link,
          salary: salaryDisplay,
          job_id: item.job_id || `rapid-${Date.now()}`,
          workplaceType: (item.job_is_remote ? 'remote' : 'onsite') as 'remote' | 'hybrid' | 'onsite',
          requiredSkills: item.job_required_skills || [],
        };
      }).filter(Boolean),
    },
    {
      host: 'jobs-api14.p.rapidapi.com',
      url: `https://jobs-api14.p.rapidapi.com/list?query=${encodeURIComponent(queryStr)}&location=${encodeURIComponent(params.location || 'India')}&language=en_GB&remoteOnly=false&datePosted=month&employmentTypes=fulltime&index=0`,
      parse: (data: any) => (data.jobs || []).map((item: any) => {
        if (!item.title || !item.company || !item.jobProviders?.[0]?.url) return null;
        return {
          title: item.title,
          company_name: item.company,
          location: item.location || params.location || 'India',
          description: item.description || '',
          apply_url: item.jobProviders[0].url,
          salary: item.salaryRange || undefined,
          job_id: `japi14-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          workplaceType: (item.employmentType === 'REMOTE' ? 'remote' : 'onsite') as 'remote' | 'hybrid' | 'onsite',
          requiredSkills: [],
        };
      }).filter(Boolean),
    },
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': endpoint.host,
        },
      });

      if (res.status === 403) continue; // Not subscribed — try next

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, jobs: [], error: `RapidAPI (${endpoint.host}) HTTP ${res.status}: ${errText.slice(0, 200)}` };
      }

      const data = await res.json() as any;
      const jobs = (endpoint.parse(data) as RapidJobItem[]).slice(0, maxItems);
      return { success: true, jobs };
    } catch (err: any) {
      // Network error — return immediately
      return { success: false, jobs: [], error: err.message || 'Failed to query RapidAPI' };
    }
  }

  return {
    success: false,
    jobs: [],
    error: 'Not subscribed to any RapidAPI job endpoint. Subscribe to "JSearch" at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch to enable this source.',
  };
}
