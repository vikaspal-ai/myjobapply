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

  const query = `${params.query} in ${params.location || 'India'}`;
  const url = new URL('https://jsearch.p.rapidapi.com/search');
  url.searchParams.set('query', query);
  url.searchParams.set('page', '1');
  url.searchParams.set('num_pages', '1');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, jobs: [], error: `RapidAPI returned HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json() as any;
    const rawList = data.data || [];

    const jobs: RapidJobItem[] = [];
    const maxItems = params.limit || 15;

    for (const item of rawList.slice(0, maxItems)) {
      if (!item.job_title || !item.employer_name || !item.job_apply_link) continue;

      let workplaceType: 'remote' | 'hybrid' | 'onsite' = item.job_is_remote ? 'remote' : 'onsite';
      const locDisplay = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || params.location || 'India';

      let salaryDisplay = 'Competitive';
      if (item.job_min_salary && item.job_max_salary) {
        const curr = item.job_salary_currency || 'INR';
        const minK = Math.round(item.job_min_salary / 1000);
        const maxK = Math.round(item.job_max_salary / 1000);
        salaryDisplay = `${curr} ${minK}k - ${maxK}k ${item.job_salary_period || 'PA'}`;
      }

      jobs.push({
        title: item.job_title,
        company_name: item.employer_name,
        company_domain: item.employer_website ? new URL(item.employer_website.startsWith('http') ? item.employer_website : `https://${item.employer_website}`).hostname : '',
        location: locDisplay,
        description: item.job_description || '',
        apply_url: item.job_apply_link,
        salary: salaryDisplay,
        job_id: item.job_id || `rapid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        workplaceType,
        requiredSkills: item.job_required_skills || [],
      });
    }

    return { success: true, jobs };
  } catch (err: any) {
    return { success: false, jobs: [], error: err.message || 'Failed to query RapidAPI JSearch' };
  }
}
