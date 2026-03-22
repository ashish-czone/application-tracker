import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { FieldDefinitionService } from '@packages/eav-attributes';

@ApiTags('entities')
@Controller('entities')
export class EntityMetadataController {
  constructor(
    private readonly fieldDefinitionService: FieldDefinitionService,
  ) {}

  @Get(':entityType/fields')
  @ApiOperation({ summary: 'Get all fields for an entity type' })
  @ApiParam({ name: 'entityType', example: 'tasks', description: 'The entity type to retrieve fields for' })
  async getFields(@Param('entityType') entityType: string) {
    const fields = await this.fieldDefinitionService.listByEntity(entityType);

    // For picklist/multi_select fields, load options inline
    const result = await Promise.all(
      fields.map(async (field) => {
        const base: {
          key: string;
          label: string;
          type: string;
          required: boolean;
          isSystem: boolean;
          isCustom: boolean;
          isUnique: boolean;
          maxLength: number | null;
          defaultValue: string | null;
          options?: string[];
        } = {
          key: field.fieldKey,
          label: field.label,
          type: field.fieldType,
          required: field.isRequired,
          isSystem: field.isSystem,
          isCustom: field.isCustom,
          isUnique: field.isUnique,
          maxLength: field.maxLength,
          defaultValue: field.defaultValue,
        };

        if (field.fieldType === 'picklist' || field.fieldType === 'multi_select') {
          const options = await this.fieldDefinitionService.getPicklistOptions(field.id);
          base.options = options.map((o) => o.value);
        }

        return base;
      }),
    );

    return result;
  }
}
