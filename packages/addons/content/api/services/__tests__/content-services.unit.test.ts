import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestimonialsService } from '../testimonials.service';
import { FaqItemsService } from '../faq-items.service';
import { TeamMembersService } from '../team-members.service';
import { ServicesService } from '../services.service';
import { ClientLogosService } from '../client-logos.service';
import { ValuePropsService } from '../value-props.service';
import { StatsService } from '../stats.service';

function makeEntityService() {
  return {
    list: vi.fn(),
    findOneOrFail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    clone: vi.fn(),
    restore: vi.fn(),
    getListLayout: vi.fn(),
  };
}

const serviceCtors = [
  ['TestimonialsService', (e: any) => new TestimonialsService(e)],
  ['FaqItemsService', (e: any) => new FaqItemsService(e)],
  ['TeamMembersService', (e: any) => new TeamMembersService(e)],
  ['ServicesService', (e: any) => new ServicesService(e)],
  ['ClientLogosService', (e: any) => new ClientLogosService(e)],
  ['ValuePropsService', (e: any) => new ValuePropsService(e)],
  ['StatsService', (e: any) => new StatsService(e)],
] as const;

describe.each(serviceCtors)('%s CRUD delegates', (_name, make) => {
  let entityService: ReturnType<typeof makeEntityService>;
  let service: any;

  beforeEach(() => {
    entityService = makeEntityService();
    service = make(entityService);
  });

  it('list forwards query + accessCtx', () => {
    service.list({ page: 1 }, { userId: 'u' });
    expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, { userId: 'u' });
  });
  it('findOne forwards', () => {
    service.findOne('id-1', { userId: 'u' });
    expect(entityService.findOneOrFail).toHaveBeenCalledWith('id-1', { userId: 'u' });
  });
  it('create forwards', () => {
    service.create({ foo: 'bar' }, 'actor-1');
    expect(entityService.create).toHaveBeenCalledWith({ foo: 'bar' }, 'actor-1');
  });
  it('update forwards', () => {
    service.update('id-1', { foo: 'bar' }, 'actor-1');
    expect(entityService.update).toHaveBeenCalledWith('id-1', { foo: 'bar' }, 'actor-1', undefined);
  });
  it('softDelete forwards', () => {
    service.softDelete('id-1', 'actor-1');
    expect(entityService.softDelete).toHaveBeenCalledWith('id-1', 'actor-1', undefined);
  });
  it('clone forwards', () => {
    service.clone('id-1', 'actor-1');
    expect(entityService.clone).toHaveBeenCalledWith('id-1', 'actor-1');
  });
  it('restore forwards', () => {
    service.restore('id-1');
    expect(entityService.restore).toHaveBeenCalledWith('id-1');
  });
  it('getListLayout forwards', () => {
    service.getListLayout();
    expect(entityService.getListLayout).toHaveBeenCalled();
  });
});
