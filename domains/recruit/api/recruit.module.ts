import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { TASKS_CONFIG, TasksModule } from '@packages/tasks';

import { SharedModule } from './shared/shared.module';

import { CandidatesModule } from './candidates/candidates.module';

import { ClientsModule } from './clients/clients.module';

import { ContactsModule } from './contacts/contacts.module';
import { VendorsModule } from './vendors/vendors.module';

import { JobOpeningsModule } from './job-openings/job-openings.module';

import { ApplicationsModule } from './applications/applications.module';

import { InterviewsModule } from './interviews/interviews.module';

import { OffersModule } from './offers/offers.module';
import { offersConfig } from './offers/offers.config';

@Module({
  imports: [
    SharedModule,

    CandidatesModule,

    ClientsModule,

    ContactsModule,
    VendorsModule,

    JobOpeningsModule,

    ApplicationsModule,

    InterviewsModule,

    EntityEngineModule.forEntity(offersConfig),
    OffersModule,

    EntityEngineModule.forEntity(TASKS_CONFIG),
    TasksModule,
  ],
})
export class RecruitDomainModule {}
