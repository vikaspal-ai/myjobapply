import * as cheerio from 'cheerio';
import {
  FormField,
  FormFieldType,
  FormInspectionResult,
  FormOption,
  StandardFieldCategory,
} from './types.js';

export class FormInspector {
  /**
   * Inspects and classifies an HTML application form into structured field descriptors.
   */
  inspectForm(html: string): FormInspectionResult {
    const $ = cheerio.load(html);

    // 1. Detect ATS Platform
    let detectedAts: string | undefined;
    if (/boards\.greenhouse\.io|gh_jid|greenhouse/i.test(html)) {
      detectedAts = 'Greenhouse';
    } else if (/lever\.co|lever-form/i.test(html)) {
      detectedAts = 'Lever';
    } else if (/myworkdayjobs\.com|workday/i.test(html)) {
      detectedAts = 'Workday';
    } else if (/ashbyhq\.com|ashby/i.test(html)) {
      detectedAts = 'Ashby';
    } else if (/smartrecruiters\.com/i.test(html)) {
      detectedAts = 'SmartRecruiters';
    }

    const formEl = $('form').first();
    const formAction = formEl.attr('action') || undefined;
    const formMethod = (formEl.attr('method') || 'POST').toUpperCase();

    const fields: FormField[] = [];

    // Helper: Find label text associated with an element
    const findLabel = (el: cheerio.Cheerio<any>): string => {
      const id = el.attr('id');
      if (id) {
        const labelFor = $(`label[for="${id}"]`).text().trim();
        if (labelFor) return labelFor;
      }
      const parentLabel = el.closest('label').text().trim();
      if (parentLabel) return parentLabel;

      const ariaLabel = el.attr('aria-label') || el.attr('placeholder') || '';
      if (ariaLabel) return ariaLabel;

      // Check specific form field containers (avoid loose generic div)
      const containerText = el.closest('.form-group, .field, .input-container, .form-item, .form-field').find('label').first().text().trim();
      if (containerText) return containerText;

      return el.attr('name') || '';
    };

    // 2. Process Input elements
    $('input').each((_, input) => {
      const el = $(input);
      const rawType = (el.attr('type') || 'text').toLowerCase();
      if (rawType === 'submit' || rawType === 'button' || rawType === 'reset') return;

      const name = el.attr('name') || el.attr('id') || `input_${fields.length}`;
      const isHidden = rawType === 'hidden';
      const label = isHidden ? '' : findLabel(el);
      const required = el.prop('required') || el.attr('aria-required') === 'true';

      let type: FormFieldType = 'text';
      if (rawType === 'email') type = 'email';
      else if (rawType === 'tel') type = 'tel';
      else if (rawType === 'file') type = 'file';
      else if (rawType === 'radio') type = 'radio';
      else if (rawType === 'checkbox') type = 'checkbox';
      else if (isHidden) type = 'hidden';

      const standardCategory = isHidden ? 'custom' : this.classifyField(name, label, type);

      fields.push({
        id: el.attr('id'),
        name,
        label,
        type,
        required: !!required,
        standardCategory,
        selector: el.attr('id') ? `#${el.attr('id')}` : `input[name="${name}"]`,
      });
    });

    // 3. Process Textarea elements
    $('textarea').each((_, textarea) => {
      const el = $(textarea);
      const name = el.attr('name') || el.attr('id') || `textarea_${fields.length}`;
      const label = findLabel(el);
      const required = el.prop('required') || el.attr('aria-required') === 'true';

      const standardCategory = this.classifyField(name, label, 'textarea');

      fields.push({
        id: el.attr('id'),
        name,
        label,
        type: 'textarea',
        required: !!required,
        standardCategory,
        selector: el.attr('id') ? `#${el.attr('id')}` : `textarea[name="${name}"]`,
      });
    });

    // 4. Process Select dropdown elements
    $('select').each((_, select) => {
      const el = $(select);
      const name = el.attr('name') || el.attr('id') || `select_${fields.length}`;
      const label = findLabel(el);
      const required = el.prop('required') || el.attr('aria-required') === 'true';

      const options: FormOption[] = [];
      el.find('option').each((_, opt) => {
        const optEl = $(opt);
        const val = optEl.attr('value') || optEl.text().trim();
        const text = optEl.text().trim();
        if (val || text) {
          options.push({ label: text, value: val });
        }
      });

      const standardCategory = this.classifyField(name, label, 'select');

      fields.push({
        id: el.attr('id'),
        name,
        label,
        type: 'select',
        required: !!required,
        options,
        standardCategory,
        selector: el.attr('id') ? `#${el.attr('id')}` : `select[name="${name}"]`,
      });
    });

    // 5. Aggregate Standard vs Custom
    const standardFields = fields.filter((f) => f.standardCategory !== 'custom' && f.type !== 'hidden');
    const customQuestions = fields.filter((f) => f.standardCategory === 'custom' && f.type !== 'hidden');

    const hasResumeUpload = fields.some(
      (f) => f.type === 'file' && (f.standardCategory === 'resume' || /resume|cv/i.test(f.label + f.name))
    );
    const hasCoverLetterUpload = fields.some(
      (f) => f.type === 'file' && (f.standardCategory === 'cover_letter' || /cover\s*letter/i.test(f.label + f.name))
    );

    return {
      formAction,
      formMethod,
      fields,
      hasResumeUpload,
      hasCoverLetterUpload,
      standardFields,
      customQuestions,
      detectedAts,
    };
  }

  /**
   * Deterministic rule-based classification mapping input attributes to standard categories.
   */
  classifyField(name: string, label: string, type: FormFieldType): StandardFieldCategory {
    const combined = `${name} ${label}`.toLowerCase();

    // File uploads
    if (type === 'file') {
      if (/cover\s*letter/i.test(combined)) return 'cover_letter';
      if (/resume|cv/i.test(combined)) return 'resume';
    }

    // First and Last Names
    if (/\b(?:first[_\s-]?name|given[_\s-]?name|fname)\b/i.test(combined)) return 'first_name';
    if (/\b(?:last[_\s-]?name|family[_\s-]?name|surname|lname)\b/i.test(combined)) return 'last_name';
    if (/\b(?:full[_\s-]?name)\b/i.test(combined) || (/\bname\b/i.test(combined) && !/company|file|user/i.test(combined))) {
      return 'full_name';
    }

    // Email
    if (type === 'email' || /\b(?:email|e-mail)\b/i.test(combined)) return 'email';

    // Phone
    if (type === 'tel' || /\b(?:phone|mobile|cell|telephone)\b/i.test(combined)) return 'phone';

    // Location
    if (/\b(?:location|city|address|country|zip|postal)\b/i.test(combined)) return 'location';

    // URLs / Profiles
    if (/linkedin/i.test(combined)) return 'linkedin';
    if (/github/i.test(combined)) return 'github';
    if (/portfolio|website|homepage|personal\s*url/i.test(combined)) return 'portfolio';

    // Sensitive / Legal / Verification Questions
    if (/require.*sponsorship|visa.*sponsorship|need.*sponsorship/i.test(combined)) return 'sponsorship';
    if (/authoriz|legally.*work|eligible.*work/i.test(combined)) return 'work_authorization';
    if (/notice.*period|start.*date|how.*soon.*start|availability/i.test(combined)) return 'notice_period';
    if (/salary|compensation|desired.*pay/i.test(combined)) return 'salary';

    return 'custom';
  }
}

export const formInspector = new FormInspector();
