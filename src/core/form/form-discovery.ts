/**
 * Simplified Form Discovery for MVP
 * Focuses on semantic HTML forms (most common case)
 */

import { Page } from 'playwright';
import { DiscoveredForm, DiscoveredField } from './types';

export class FormDiscovery {
  constructor(private page: Page) {}

  async detectForms(): Promise<DiscoveredForm[]> {
    const forms = await this.page.$$eval('form', (formElements) => {
      return formElements.map((form, formIndex) => {
        const fields: any[] = [];

        // Get all input/select/textarea elements
        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));

        inputs.forEach((el, fieldIndex) => {
          const input = el as HTMLInputElement;

          // Skip submit/button/hidden
          if (input.type === 'submit' || input.type === 'button' || input.type === 'hidden') {
            return;
          }

          // Find label
          let label = '';
          if (input.id) {
            const labelEl = form.querySelector('label[for="' + input.id + '"]');
            if (labelEl) label = labelEl.textContent?.trim() || '';
          }
          if (!label) {
            const parentLabel = input.closest('label');
            if (parentLabel) label = parentLabel.textContent?.trim() || '';
          }
          if (!label) label = input.placeholder || input.name || 'Field ' + (fieldIndex + 1);

          fields.push({
            id: input.id || input.name || 'field-' + formIndex + '-' + fieldIndex,
            type: input.type || input.tagName.toLowerCase(),
            selector: input.id ? '#' + input.id : '[name="' + input.name + '"]',
            label,
            required: input.required,
            validationRules: input.required ? [{ type: 'required' }] : [],
            placeholder: input.placeholder || undefined,
            ariaLabel: input.getAttribute('aria-label') || undefined,
          });
        });

        // Find submit button
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLButtonElement;

        return {
          id: form.id || 'form-' + formIndex,
          name: form.getAttribute('name') || undefined,
          action: (form as HTMLFormElement).action || undefined,
          method: (form as HTMLFormElement).method || undefined,
          fields,
          submitButton: submitBtn ? {
            text: submitBtn.textContent?.trim() || (submitBtn as HTMLInputElement).value || 'Submit',
            selector: submitBtn.id ? '#' + submitBtn.id : 'button[type="submit"]'
          } : undefined,
          isWizard: false,
        };
      });
    });

    return forms;
  }
}
