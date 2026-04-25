import type { ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';

interface ContactFormPlaceholderFields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  submitLabel?: string;
  helperText?: string;
}

/**
 * Visual-only contact section. Fields are disabled and the CTA button
 * doesn't submit — this is a placeholder until a real form handler
 * lands. Keeps the public site from having an obvious gap where the
 * contact page would normally sit.
 */
function ContactFormPlaceholder({ fields }: BlockRenderProps<ContactFormPlaceholderFields>): ReactNode {
  const {
    heading,
    subheading,
    submitLabel = 'Send message',
    helperText = 'Form submissions are not wired up yet. Email us directly for now.',
  } = fields;

  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6 md:px-10 flex flex-col gap-12">
        {(heading || subheading) && (
          <div className="flex flex-col gap-3 max-w-2xl">
            {heading && (
              <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] leading-[1.05]">
                {heading}
              </h2>
            )}
            {subheading && (
              <p className="text-lg text-[hsl(var(--muted-foreground))]">{subheading}</p>
            )}
          </div>
        )}
        <form
          aria-disabled
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 md:p-10"
        >
          <PlaceholderField label="Name" placeholder="Your full name" />
          <PlaceholderField label="Email" type="email" placeholder="you@example.com" />
          <PlaceholderField
            label="Message"
            placeholder="Tell us about your project…"
            multiline
          />
          <button
            type="submit"
            disabled
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] opacity-60 cursor-not-allowed"
          >
            {submitLabel}
            <span aria-hidden>→</span>
          </button>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{helperText}</p>
        </form>
      </div>
    </section>
  );
}

interface PlaceholderFieldProps {
  label: string;
  placeholder: string;
  type?: string;
  multiline?: boolean;
}

function PlaceholderField({ label, placeholder, type = 'text', multiline }: PlaceholderFieldProps): ReactNode {
  const commonClass =
    'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] opacity-80';
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={4} disabled placeholder={placeholder} className={commonClass} />
      ) : (
        <input type={type} disabled placeholder={placeholder} className={commonClass} />
      )}
    </label>
  );
}

export const contactFormPlaceholderBlock = defineBlock<ContactFormPlaceholderFields>({
  kind: 'contact-form-placeholder',
  name: 'Contact Form',
  category: 'Content',
  icon: 'Mail',
  fields: {
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
    submitLabel: {
      type: 'text',
      label: 'Submit button label',
      maxLength: 40,
      description: 'Defaults to "Send message".',
    },
    helperText: {
      type: 'textarea',
      label: 'Helper text',
      maxLength: 200,
      description: 'Small note under the form. Defaults to a "not wired up" disclosure.',
    },
  },
  component: ContactFormPlaceholder,
});
