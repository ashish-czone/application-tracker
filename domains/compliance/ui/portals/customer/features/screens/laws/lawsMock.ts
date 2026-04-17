export type LawJurisdiction = 'central' | 'state' | 'municipal';

export interface LawNode {
  id: string;
  citation: string;
  title: string;
  jurisdiction: LawJurisdiction;
  effectiveFrom?: string;
  obligationCount?: number;
  children?: LawNode[];
}

export const LAWS: LawNode[] = [
  {
    id: 'act-co-2013',
    citation: 'Companies Act 2013',
    title: 'An Act to consolidate and amend the law relating to companies',
    jurisdiction: 'central',
    effectiveFrom: '2013-08-30',
    obligationCount: 147,
    children: [
      {
        id: 'act-co-2013-ch-ix',
        citation: 'Chapter IX',
        title: 'Accounts of Companies',
        jurisdiction: 'central',
        obligationCount: 34,
        children: [
          {
            id: 'act-co-2013-s-129',
            citation: 'Section 129',
            title: 'Financial statement',
            jurisdiction: 'central',
            effectiveFrom: '2014-04-01',
            obligationCount: 6,
          },
          {
            id: 'act-co-2013-s-134',
            citation: 'Section 134',
            title: 'Financial statement, Board\u2019s report, etc.',
            jurisdiction: 'central',
            effectiveFrom: '2014-04-01',
            obligationCount: 9,
          },
          {
            id: 'act-co-2013-s-137',
            citation: 'Section 137',
            title: 'Copy of financial statement to be filed with Registrar',
            jurisdiction: 'central',
            effectiveFrom: '2014-04-01',
            obligationCount: 4,
          },
        ],
      },
      {
        id: 'act-co-2013-ch-x',
        citation: 'Chapter X',
        title: 'Audit and Auditors',
        jurisdiction: 'central',
        obligationCount: 21,
        children: [
          {
            id: 'act-co-2013-s-139',
            citation: 'Section 139',
            title: 'Appointment of auditors',
            jurisdiction: 'central',
            effectiveFrom: '2014-04-01',
            obligationCount: 5,
          },
          {
            id: 'act-co-2013-s-143',
            citation: 'Section 143',
            title: 'Powers and duties of auditors',
            jurisdiction: 'central',
            effectiveFrom: '2014-04-01',
            obligationCount: 7,
          },
        ],
      },
    ],
  },
  {
    id: 'act-gst-2017',
    citation: 'CGST Act 2017',
    title: 'Central Goods and Services Tax Act',
    jurisdiction: 'central',
    effectiveFrom: '2017-07-01',
    obligationCount: 89,
    children: [
      {
        id: 'act-gst-s-37',
        citation: 'Section 37',
        title: 'Furnishing details of outward supplies',
        jurisdiction: 'central',
        effectiveFrom: '2017-07-01',
        obligationCount: 3,
      },
      {
        id: 'act-gst-s-39',
        citation: 'Section 39',
        title: 'Furnishing of returns',
        jurisdiction: 'central',
        effectiveFrom: '2017-07-01',
        obligationCount: 5,
      },
      {
        id: 'act-gst-s-44',
        citation: 'Section 44',
        title: 'Annual return',
        jurisdiction: 'central',
        effectiveFrom: '2017-07-01',
        obligationCount: 2,
      },
    ],
  },
  {
    id: 'act-it-1961',
    citation: 'Income Tax Act 1961',
    title: 'Act to levy, administer, collect and recover income tax',
    jurisdiction: 'central',
    effectiveFrom: '1962-04-01',
    obligationCount: 62,
  },
  {
    id: 'act-sebi-lodr',
    citation: 'SEBI LODR 2015',
    title: 'Listing Obligations and Disclosure Requirements',
    jurisdiction: 'central',
    effectiveFrom: '2015-12-01',
    obligationCount: 54,
  },
  {
    id: 'act-mh-spa',
    citation: 'Maharashtra Shops & Establishment Act',
    title: 'Registration and regulation of shops and commercial establishments',
    jurisdiction: 'state',
    effectiveFrom: '2017-12-19',
    obligationCount: 12,
  },
];
