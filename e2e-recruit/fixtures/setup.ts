import type { Page } from '@playwright/test';
import { setupAuth } from './auth';
import { mockGlobalApis, mockEntityApi, type MockEntity } from './mock-api';
import { candidateEntity, candidateListColumns, candidateLayoutSections, generateCandidates, candidateSearchColumns } from './data/candidates';
import { jobOpeningEntity, jobOpeningListColumns, jobOpeningLayoutSections, generateJobOpenings, jobOpeningSearchColumns } from './data/job-openings';
import { clientEntity, clientListColumns, clientLayoutSections, generateClients, clientSearchColumns } from './data/clients';
import { contactEntity, contactListColumns, contactLayoutSections, generateContacts, contactSearchColumns } from './data/contacts';
import { vendorEntity, vendorListColumns, vendorLayoutSections, generateVendors, vendorSearchColumns } from './data/vendors';
import { applicationEntity, applicationListColumns, applicationLayoutSections, generateApplications, applicationSearchColumns } from './data/applications';
import { interviewEntity, interviewListColumns, interviewLayoutSections, generateInterviews, interviewSearchColumns } from './data/interviews';
import { offerEntity, offerListColumns, offerLayoutSections, generateOffers, offerSearchColumns } from './data/offers';

/** All recruit entities for the registry mock */
export const ALL_ENTITIES: MockEntity[] = [
  candidateEntity, jobOpeningEntity, clientEntity, contactEntity,
  vendorEntity, applicationEntity, interviewEntity, offerEntity,
];

/** Pre-generated mock data */
export const MOCK_DATA = {
  candidates: generateCandidates(),
  jobOpenings: generateJobOpenings(),
  clients: generateClients(),
  contacts: generateContacts(),
  vendors: generateVendors(),
  applications: generateApplications(),
  interviews: generateInterviews(),
  offers: generateOffers(),
};

/**
 * Full setup: auth init script + route mocks, all before any navigation.
 * setupAuth uses addInitScript (no navigation needed).
 * Route mocks intercept all /api/v1/* requests.
 */
export async function setupAllMocks(page: Page) {
  // 1. Auth via addInitScript (sets localStorage before any page JS runs)
  await setupAuth(page);

  // 2. Set up all route mocks before any navigation
  await mockGlobalApis(page, ALL_ENTITIES);

  await mockEntityApi(page, {
    entity: candidateEntity,
    listColumns: candidateListColumns,
    layoutSections: candidateLayoutSections,
    records: MOCK_DATA.candidates,
    searchColumns: candidateSearchColumns,
  });

  await mockEntityApi(page, {
    entity: jobOpeningEntity,
    listColumns: jobOpeningListColumns,
    layoutSections: jobOpeningLayoutSections,
    records: MOCK_DATA.jobOpenings,
    searchColumns: jobOpeningSearchColumns,
  });

  await mockEntityApi(page, {
    entity: clientEntity,
    listColumns: clientListColumns,
    layoutSections: clientLayoutSections,
    records: MOCK_DATA.clients,
    searchColumns: clientSearchColumns,
  });

  await mockEntityApi(page, {
    entity: contactEntity,
    listColumns: contactListColumns,
    layoutSections: contactLayoutSections,
    records: MOCK_DATA.contacts,
    searchColumns: contactSearchColumns,
  });

  await mockEntityApi(page, {
    entity: vendorEntity,
    listColumns: vendorListColumns,
    layoutSections: vendorLayoutSections,
    records: MOCK_DATA.vendors,
    searchColumns: vendorSearchColumns,
  });

  await mockEntityApi(page, {
    entity: applicationEntity,
    listColumns: applicationListColumns,
    layoutSections: applicationLayoutSections,
    records: MOCK_DATA.applications,
    searchColumns: applicationSearchColumns,
  });

  await mockEntityApi(page, {
    entity: interviewEntity,
    listColumns: interviewListColumns,
    layoutSections: interviewLayoutSections,
    records: MOCK_DATA.interviews,
    searchColumns: interviewSearchColumns,
  });

  await mockEntityApi(page, {
    entity: offerEntity,
    listColumns: offerListColumns,
    layoutSections: offerLayoutSections,
    records: MOCK_DATA.offers,
    searchColumns: offerSearchColumns,
  });

}
