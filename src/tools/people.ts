import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ProductivePersonCreate, ProductivePersonUpdate } from '../api/types.js';

// --- List People ---

const listPeopleSchema = z.object({
  company_id: z.string().optional(),
  project_id: z.string().optional(),
  is_active: z.boolean().optional(),
  email: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().optional(),
});

export async function listPeopleTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listPeopleSchema.parse(args || {});

    const response = await client.listPeople({
      company_id: params.company_id,
      project_id: params.project_id,
      is_active: params.is_active,
      email: params.email,
      limit: params.limit,
      page: params.page,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text', text: 'No people found matching the criteria.' }],
      };
    }

    const peopleText = response.data.filter(p => p && p.attributes).map(person => {
      const a = person.attributes;
      const extras: string[] = [];
      if (a.email) extras.push(`Email: ${a.email}`);
      if (a.title) extras.push(`Title: ${a.title}`);
      if (a.role) extras.push(`Role: ${a.role}`);
      if (a.is_active !== undefined) extras.push(`Active: ${a.is_active}`);
      const companyId = person.relationships?.company?.data?.id;
      if (companyId) extras.push(`Company ID: ${companyId}`);

      return `\u2022 ${a.first_name} ${a.last_name} (ID: ${person.id})\n  ${extras.join('\n  ') || 'No details'}`;
    }).join('\n\n');

    const summary = `Found ${response.data.length} ${response.data.length !== 1 ? 'people' : 'person'}${response.meta?.total_count ? ` (showing ${response.data.length} of ${response.meta.total_count})` : ''}:\n\n${peopleText}`;

    return { content: [{ type: 'text', text: summary }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listPeopleDefinition = {
  name: 'list_people',
  description: 'List people from Productive.io. Returns employees, contractors, and contacts in the organization.',
  inputSchema: {
    type: 'object',
    properties: {
      company_id: { type: 'string', description: 'Filter by company ID' },
      project_id: { type: 'string', description: 'Filter by project ID' },
      is_active: { type: 'boolean', description: 'Filter by active status' },
      email: { type: 'string', description: 'Filter by email address' },
      limit: { type: 'number', description: 'Number of results (1-200)', minimum: 1, maximum: 200, default: 30 },
      page: { type: 'number', description: 'Page number for pagination' },
    },
  },
};

// --- Get Person ---

const getPersonSchema = z.object({
  id: z.string().min(1, 'Person ID is required'),
});

export async function getPersonTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getPersonSchema.parse(args);
    const response = await client.getPerson(params.id, { include: 'company' });
    const p = response.data;
    const a = p.attributes;

    const lines: string[] = [
      `Person: ${a.first_name} ${a.last_name} (ID: ${p.id})`,
      a.email ? `Email: ${a.email}` : '',
      a.title ? `Title: ${a.title}` : '',
      a.role ? `Role: ${a.role}` : '',
      a.is_active !== undefined ? `Active: ${a.is_active}` : '',
      `Created: ${a.created_at}`,
    ].filter(Boolean);

    const companyId = p.relationships?.company?.data?.id;
    if (companyId) {
      const companyAttrs = response.included?.find(i => i.type === 'companies' && i.id === companyId)?.attributes;
      if (companyAttrs?.name) {
        lines.push(`Company: ${companyAttrs.name} (ID: ${companyId})`);
      } else {
        lines.push(`Company ID: ${companyId}`);
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getPersonDefinition = {
  name: 'get_person',
  description: 'Get a single person by ID from Productive.io.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Person ID (required)' },
    },
    required: ['id'],
  },
};

// --- Create Person ---

const createPersonSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  title: z.string().optional(),
  hrm_type_id: z.number().optional(),
  company_id: z.string().optional(),
});

export async function createPersonTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createPersonSchema.parse(args);

    const personData: ProductivePersonCreate = {
      data: {
        type: 'people',
        attributes: {
          first_name: params.first_name,
          last_name: params.last_name,
          email: params.email,
          ...(params.title && { title: params.title }),
          ...(params.hrm_type_id && { hrm_type_id: params.hrm_type_id }),
        },
        ...(params.company_id && {
          relationships: {
            company: { data: { id: params.company_id, type: 'companies' } },
          },
        }),
      },
    };

    const response = await client.createPerson(personData);
    const p = response.data;
    const a = p.attributes;

    const lines: string[] = [
      `Person created successfully!`,
      ``,
      `Name: ${a.first_name} ${a.last_name} (ID: ${p.id})`,
      a.email ? `Email: ${a.email}` : '',
      a.title ? `Title: ${a.title}` : '',
    ].filter(Boolean);

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createPersonDefinition = {
  name: 'create_person',
  description: 'Create a new person in Productive.io. Use hrm_type_id: 1 for employees/contractors (can track time), 2 for contacts (client contacts, no time tracking).',
  inputSchema: {
    type: 'object',
    properties: {
      first_name: { type: 'string', description: 'First name (required)' },
      last_name: { type: 'string', description: 'Last name (required)' },
      email: { type: 'string', description: 'Email address (required)' },
      title: { type: 'string', description: 'Job title (optional)' },
      hrm_type_id: { type: 'number', description: 'Person type: 1=Employee/Contractor (can track time), 2=Contact (client contact). Default: 2' },
      company_id: { type: 'string', description: 'Company ID to associate with (optional)' },
    },
    required: ['first_name', 'last_name', 'email'],
  },
};

// --- Update Person ---

const updatePersonSchema = z.object({
  id: z.string().min(1, 'Person ID is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  title: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  company_id: z.string().nullable().optional(),
});

export async function updatePersonTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updatePersonSchema.parse(args);

    const attributes: Record<string, unknown> = {};
    if (params.first_name !== undefined) attributes.first_name = params.first_name;
    if (params.last_name !== undefined) attributes.last_name = params.last_name;
    if (params.email !== undefined) attributes.email = params.email;
    if (params.title !== undefined) attributes.title = params.title;
    if (params.is_active !== undefined) attributes.is_active = params.is_active;

    const hasAttributes = Object.keys(attributes).length > 0;
    const hasCompany = params.company_id !== undefined;

    if (!hasAttributes && !hasCompany) {
      throw new McpError(ErrorCode.InvalidParams, 'No fields to update. Provide at least one field.');
    }

    const personData: ProductivePersonUpdate = {
      data: {
        type: 'people',
        id: params.id,
        ...(hasAttributes && {
          attributes: attributes as ProductivePersonUpdate['data']['attributes'],
        }),
        ...(hasCompany && {
          relationships: {
            company: params.company_id
              ? { data: { id: params.company_id, type: 'companies' } }
              : undefined,
          },
        }),
      },
    };

    const response = await client.updatePerson(params.id, personData);
    const p = response.data;
    const a = p.attributes;

    const updated = Object.keys(attributes).map(k => `  \u2022 ${k}: ${attributes[k] ?? '(cleared)'}`);
    if (hasCompany) updated.push(`  \u2022 company_id: ${params.company_id ?? '(cleared)'}`);

    return {
      content: [{
        type: 'text',
        text: `Person ${p.id} updated successfully!\n\nName: ${a.first_name} ${a.last_name}\nUpdated fields:\n${updated.join('\n')}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updatePersonDefinition = {
  name: 'update_person',
  description: 'Update a person in Productive.io. Only provide fields you want to change.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Person ID to update (required)' },
      first_name: { type: 'string', description: 'New first name' },
      last_name: { type: 'string', description: 'New last name' },
      email: { type: 'string', description: 'New email address' },
      title: { type: ['string', 'null'], description: 'New job title (null to clear)' },
      is_active: { type: 'boolean', description: 'Active status' },
      company_id: { type: ['string', 'null'], description: 'New company ID (null to clear)' },
    },
    required: ['id'],
  },
};

// --- List Custom Roles ---

export async function listCustomRolesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const response = await client.listCustomRoles({ limit: 50 });

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: 'No custom roles found.' }] };
    }

    const rolesText = response.data.map(role => {
      const a = role.attributes;
      return `\u2022 ${a.name || 'Unnamed'} (ID: ${role.id})${a.description ? `\n  ${a.description}` : ''}`;
    }).join('\n\n');

    return { content: [{ type: 'text', text: `Found ${response.data.length} custom roles:\n\n${rolesText}` }] };
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listCustomRolesDefinition = {
  name: 'list_custom_roles',
  description: 'List custom roles available in Productive.io. Needed for inviting people to the organization.',
  inputSchema: { type: 'object', properties: {} },
};

// --- Invite Person ---

const invitePersonSchema = z.object({
  id: z.string().min(1, 'Person ID is required'),
  company_id: z.string().min(1, 'Company ID is required'),
  custom_role_id: z.string().min(1, 'Custom role ID is required'),
  subsidiary_id: z.string().optional(),
});

export async function invitePersonTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = invitePersonSchema.parse(args);

    // Auto-discover subsidiary if not provided
    let subsidiaryId = params.subsidiary_id;
    if (!subsidiaryId) {
      const subs = await client.listSubsidiaries();
      if (subs.data && subs.data.length > 0) {
        subsidiaryId = subs.data[0].id;
      }
    }

    const response = await client.invitePerson(params.id, params.company_id, params.custom_role_id, subsidiaryId);
    const p = response.data;
    return {
      content: [{
        type: 'text',
        text: `Person ${p.attributes.first_name} ${p.attributes.last_name} (ID: ${p.id}) invited successfully!`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

// --- Set Person Cost Rate (Salary) ---

const setCostRateSchema = z.object({
  person_id: z.string().min(1),
  hourly_rate: z.number().min(0, 'Hourly rate in dollars (e.g. 100 for $100/hr)'),
  currency: z.string().min(1),
  started_on: z.string().min(1, 'Start date YYYY-MM-DD'),
});

export async function setCostRateTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = setCostRateSchema.parse(args);

    // Find first holiday calendar
    const cals = await client.listHolidayCalendars();
    const calId = cals.data?.[0]?.id;
    if (!calId) throw new McpError(ErrorCode.InternalError, 'No holiday calendars found');

    const costInCents = Math.round(params.hourly_rate * 100);
    const standardHours = [8, 8, 8, 8, 8, 0, 0, 8, 8, 8, 8, 8, 0, 0];

    const response = await client.createSalary(params.person_id, {
      salary_type_id: 2, // hourly
      currency: params.currency,
      cost: costInCents,
      working_hours: standardHours,
      holiday_calendar_id: parseInt(calId, 10),
      started_on: params.started_on,
      overhead: false,
    });

    return {
      content: [{
        type: 'text',
        text: `Cost rate set for person ${params.person_id}: $${params.hourly_rate}/hr ${params.currency} from ${params.started_on}\nSalary ID: ${response.data.id}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const setCostRateDefinition = {
  name: 'set_cost_rate',
  description: 'Set the hourly cost rate (salary) for a person in Productive.io. Required before time entries can be created for them. Rate is in dollars (not cents).',
  inputSchema: {
    type: 'object',
    properties: {
      person_id: { type: 'string', description: 'Person ID (required)' },
      hourly_rate: { type: 'number', description: 'Hourly rate in dollars (e.g. 100 for $100/hr)' },
      currency: { type: 'string', description: 'Currency code (e.g. NZD, AUD)' },
      started_on: { type: 'string', description: 'Start date for this rate (YYYY-MM-DD)' },
    },
    required: ['person_id', 'hourly_rate', 'currency', 'started_on'],
  },
};

// --- List Cost Rates (Salaries) ---

const listCostRatesSchema = z.object({
  person_id: z.string().min(1, 'Person ID is required'),
});

export async function listCostRatesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listCostRatesSchema.parse(args);
    const response = await client.listSalaries(params.person_id);

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: `No cost rates found for person ${params.person_id}.` }] };
    }

    const lines = response.data.map(s => {
      const a = s.attributes;
      return `• ID: ${s.id} | Rate: ${a.cost} cents ${a.currency} | Type: ${a.salary_type_id} | Started: ${a.started_on || 'N/A'} | Ended: ${a.ended_on || 'ongoing'}`;
    });

    return { content: [{ type: 'text', text: `Found ${response.data.length} cost rate(s) for person ${params.person_id}:\n\n${lines.join('\n')}` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listCostRatesDefinition = {
  name: 'list_cost_rates',
  description: 'List cost rates (salaries) for a person in Productive.io. Shows rate IDs needed for update/delete operations.',
  inputSchema: {
    type: 'object',
    properties: {
      person_id: { type: 'string', description: 'Person ID (required)' },
    },
    required: ['person_id'],
  },
};

// --- Update Cost Rate ---

const updateCostRateSchema = z.object({
  id: z.string().min(1, 'Salary/cost rate ID is required'),
  started_on: z.string().optional(),
  ended_on: z.string().nullable().optional(),
  cost: z.number().optional(),
  currency: z.string().optional(),
});

export async function updateCostRateTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateCostRateSchema.parse(args);

    const attrs: Record<string, unknown> = {};
    if (params.started_on !== undefined) attrs.started_on = params.started_on;
    if (params.ended_on !== undefined) attrs.ended_on = params.ended_on;
    if (params.cost !== undefined) attrs.cost = params.cost;
    if (params.currency !== undefined) attrs.currency = params.currency;

    if (Object.keys(attrs).length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'No fields to update.');
    }

    const response = await client.updateSalary(params.id, attrs);
    const a = response.data.attributes;

    return {
      content: [{
        type: 'text',
        text: `Cost rate ${params.id} updated!\nStarted: ${a.started_on || 'N/A'} | Ended: ${a.ended_on || 'ongoing'} | Cost: ${a.cost} cents ${a.currency}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateCostRateDefinition = {
  name: 'update_cost_rate',
  description: 'Update an existing cost rate (salary) in Productive.io. Use list_cost_rates to find the rate ID first.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Cost rate/salary ID (required). Use list_cost_rates to find.' },
      started_on: { type: 'string', description: 'New start date (YYYY-MM-DD)' },
      ended_on: { type: ['string', 'null'], description: 'New end date (YYYY-MM-DD), or null for ongoing' },
      cost: { type: 'number', description: 'New hourly rate in cents (e.g. 4808 = $48.08/hr)' },
      currency: { type: 'string', description: 'New currency code' },
    },
    required: ['id'],
  },
};

export const invitePersonDefinition = {
  description: 'Invite a person to the Productive.io organization, making them eligible for time tracking. Requires a company_id and custom_role_id (use list_custom_roles to find available roles). WARNING: This may send an invitation email.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Person ID to invite (required)' },
      company_id: { type: 'string', description: 'Company ID to assign them to (required)' },
      custom_role_id: { type: 'string', description: 'Custom role ID for their permissions (required). Use list_custom_roles to find available roles.' },
    },
    required: ['id', 'company_id', 'custom_role_id'],
  },
};
