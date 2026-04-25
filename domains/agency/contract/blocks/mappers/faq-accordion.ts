import { defineMapper } from '../registry';

export interface FaqItemRecord {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export interface FaqAccordionFields extends Record<string, unknown> {
  items: Array<{
    id: string;
    question: string;
    answer: string;
    category: string | null;
  }>;
}

export const faqAccordionMapper = defineMapper<FaqItemRecord, FaqAccordionFields>({
  entity: 'faq-items',
  block: 'faq-accordion',
  map: (records) => ({
    items: records.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      category: r.category,
    })),
  }),
});
