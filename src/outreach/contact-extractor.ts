import * as cheerio from 'cheerio';
import { sql } from '../db/index.js';
import type { CompanyContactRecord, DiscoveredContact } from './types.js';

const db = sql!;

const EXCLUDED_PREFIXES = [
  'noreply',
  'no-reply',
  'abuse',
  'privacy',
  'legal',
  'security',
  'postmaster',
  'webmaster',
  'hostmaster',
  'compliance',
  'dpo',
  'dmca',
];

export class PublicContactExtractor {
  /**
   * Deterministically discovers public hiring/recruiting contacts from company web pages.
   * Strictly adheres to HLD §23: own-site extraction only, NO third-party enrichment, NO address guessing.
   */
  extractContactsFromHtml(html: string, sourceUrl: string): DiscoveredContact[] {
    const $ = cheerio.load(html);
    const discovered: DiscoveredContact[] = [];
    const seenEmails = new Set<string>();

    // 1. Extract from mailto: links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      const linkText = $(el).text().trim();

      if (this.isValidContactEmail(email) && !seenEmails.has(email)) {
        seenEmails.add(email);
        const isRecruitment = /career|job|hiring|recruit|talent|people|join/i.test(email) ||
                              /career|job|hiring|recruit|talent|people/i.test(linkText);

        discovered.push({
          email,
          name: linkText && !linkText.includes('@') ? linkText : undefined,
          roleTitle: isRecruitment ? 'Talent Acquisition / Recruiting' : 'General Contact',
          confidence: isRecruitment ? 0.95 : 0.70,
          sourceUrl,
        });
      }
    });

    // 2. Extract from text patterns (e.g. "Send your CV to careers@company.com")
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    const bodyText = $('body').text();
    const textMatches = bodyText.match(emailRegex) || [];

    for (const rawEmail of textMatches) {
      const email = rawEmail.toLowerCase().trim();
      if (this.isValidContactEmail(email) && !seenEmails.has(email)) {
        const isRecruitment = /career|job|hiring|recruit|talent|people|join/i.test(email);
        if (isRecruitment) {
          seenEmails.add(email);
          discovered.push({
            email,
            roleTitle: 'Talent Acquisition / Recruiting',
            confidence: 0.90,
            sourceUrl,
          });
        }
      }
    }

    return discovered;
  }

  /**
   * Validates if an email address is an acceptable public contact.
   */
  isValidContactEmail(email: string): boolean {
    if (!email || !email.includes('@') || email.length > 254) return false;

    // Filter out image/asset misparses (e.g. user@2x.png)
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) return false;

    const prefix = email.split('@')[0].toLowerCase();
    for (const excluded of EXCLUDED_PREFIXES) {
      if (prefix === excluded || prefix.startsWith(excluded + '+') || prefix.startsWith(excluded + '.')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Discovers contacts from HTML and saves them to outreach.company_contacts.
   */
  async saveDiscoveredContacts(
    companyId: string,
    contacts: DiscoveredContact[],
  ): Promise<CompanyContactRecord[]> {
    if (!db) throw new Error('Database client not initialized');
    if (contacts.length === 0) return [];

    const results: CompanyContactRecord[] = [];

    for (const c of contacts) {
      const [saved] = await db`
        INSERT INTO outreach.company_contacts (
          company_id,
          name,
          email,
          role_title,
          source_url,
          confidence,
          is_verified
        ) VALUES (
          ${companyId},
          ${c.name ?? null},
          ${c.email},
          ${c.roleTitle ?? null},
          ${c.sourceUrl},
          ${c.confidence},
          true
        )
        ON CONFLICT (company_id, email) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, outreach.company_contacts.name),
          role_title = COALESCE(EXCLUDED.role_title, outreach.company_contacts.role_title),
          source_url = EXCLUDED.source_url,
          confidence = EXCLUDED.confidence,
          updated_at = now()
        RETURNING *
      `;

      results.push({
        id: saved.id,
        companyId: saved.company_id,
        name: saved.name,
        email: saved.email,
        roleTitle: saved.role_title,
        sourceUrl: saved.source_url,
        confidence: Number(saved.confidence),
        isVerified: saved.is_verified,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      });
    }

    return results;
  }
}

export const contactExtractor = new PublicContactExtractor();
