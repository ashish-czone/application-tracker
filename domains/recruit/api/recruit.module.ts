import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { TASKS_CONFIG, TasksModule } from '@packages/tasks';

import { SharedModule } from './shared/shared.module';

import { candidatesConfig } from './candidates/candidates.config';

import { ClientsModule } from './clients/clients.module';

import { ContactsModule } from './contacts/contacts.module';
import { VendorsModule } from './vendors/vendors.module';

import { JOB_OPENINGS_CONFIG } from './job-openings/job-openings.config';

import { ApplicationsModule } from './applications/applications.module';
import { APPLICATIONS_CONFIG } from './applications/applications.config';

import { INTERVIEWS_CONFIG } from './interviews/interviews.config';

import { OffersModule } from './offers/offers.module';
import { offersConfig } from './offers/offers.config';

@Module({
  imports: [
    SharedModule,

    EntityEngineModule.forEntity(candidatesConfig),

    ClientsModule,

    ContactsModule,
    VendorsModule,

    EntityEngineModule.forEntity(JOB_OPENINGS_CONFIG),

    EntityEngineModule.forEntity(APPLICATIONS_CONFIG),
    ApplicationsModule,

    EntityEngineModule.forEntity(INTERVIEWS_CONFIG),

    EntityEngineModule.forEntity(offersConfig),
    OffersModule,

    EntityEngineModule.forEntity(TASKS_CONFIG),
    TasksModule,
  ],
})
export class RecruitDomainModule {}
