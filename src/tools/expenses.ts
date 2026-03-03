import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ProductiveExpenseCreate } from '../api/types.js';

// --- List Expenses ---

const listExpensesSchema = z.object({
  service_id: z.string().optional(),
  person_id: z.string().optional(),
  deal_id: z.string().optional(),
  date_after: z.string().optional(),
  date_before: z.string().optional(),
  approval_status: z.string().optional(),
  sort: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listExpensesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listExpensesSchema.parse(args);

    const response = await client.listExpenses({
      service_id: params.service_id,
      person_id: params.person_id,
      deal_id: params.deal_id,
      date_after: params.date_after,
      date_before: params.date_before,
      approval_status: params.approval_status,
      sort: params.sort,
      limit: params.limit,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text', text: 'No expenses found matching the criteria.' }],
      };
    }

    // Build lookup map from included resources
    const includedMap = new Map<string, Record<string, unknown>>();
    if (response.included) {
      for (const item of response.included) {
        includedMap.set(`${item.type}:${item.id}`, item.attributes);
      }
    }

    const expensesText = response.data.map(expense => {
      const serviceId = expense.relationships?.service?.data?.id;
      const personId = expense.relationships?.person?.data?.id;
      const dealId = expense.relationships?.deal?.data?.id;

      // Resolve names from included data
      const personAttrs = personId ? includedMap.get(`people:${personId}`) : undefined;
      const personName = personAttrs ? `${personAttrs.first_name} ${personAttrs.last_name}`.trim() : undefined;
      const serviceAttrs = serviceId ? includedMap.get(`services:${serviceId}`) : undefined;
      const serviceName = serviceAttrs?.name as string | undefined;
      const dealAttrs = dealId ? includedMap.get(`deals:${dealId}`) : undefined;
      const dealName = dealAttrs?.name as string | undefined;

      return `\u2022 Expense (ID: ${expense.id})
  Name: ${expense.attributes.name}
  Amount: ${expense.attributes.amount} ${expense.attributes.currency}
  Date: ${expense.attributes.date}
  Approved: ${expense.attributes.approved ? 'Yes' : 'No'}
  Person: ${personName || (personId ? `ID: ${personId}` : 'None')}
  Service: ${serviceName || (serviceId ? `ID: ${serviceId}` : 'None')}${dealName ? `\n  Deal: ${dealName} (ID: ${dealId})` : dealId ? `\n  Deal ID: ${dealId}` : ''}`;
    }).join('\n\n');

    const summary = `Found ${response.data.length} expense${response.data.length !== 1 ? 's' : ''}${response.meta?.total_count ? ` (showing ${response.data.length} of ${response.meta.total_count})` : ''}:\n\n${expensesText}`;

    return { content: [{ type: 'text', text: summary }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listExpensesDefinition = {
  name: 'list_expenses',
  description: 'List expenses from Productive.io. Expenses represent costs (e.g. contractor invoices) logged against a budget/deal service.',
  inputSchema: {
    type: 'object',
    properties: {
      service_id: { type: 'string', description: 'Filter by service ID' },
      person_id: { type: 'string', description: 'Filter by person ID' },
      deal_id: { type: 'string', description: 'Filter by deal/budget ID' },
      date_after: { type: 'string', description: 'Filter expenses after this date (YYYY-MM-DD)' },
      date_before: { type: 'string', description: 'Filter expenses before this date (YYYY-MM-DD)' },
      approval_status: { type: 'string', description: 'Filter by approval status' },
      sort: { type: 'string', description: 'Sort field. Prefix with - for descending. Default: -date' },
      limit: { type: 'number', description: 'Number of expenses to return (1-200)', minimum: 1, maximum: 200, default: 30 },
    },
    required: [],
  },
};

// --- Create Expense ---

const createExpenseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.string().min(1, 'Amount is required (in dollars, will be converted to cents)'),
  billable_amount: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  date: z.string().min(1, 'Date is required'),
  service_id: z.string().min(1, 'Service ID is required'),
  person_id: z.string().optional(),
  confirm: z.boolean().optional().default(false),
});

function dollarsToCents(dollars: string): string {
  const num = parseFloat(dollars);
  if (isNaN(num)) throw new Error(`Invalid amount: ${dollars}`);
  return (Math.round(num * 100)).toFixed(1);
}

export async function createExpenseTool(
  client: ProductiveAPIClient,
  args: unknown,
  config?: { PRODUCTIVE_USER_ID?: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createExpenseSchema.parse(args);

    // Handle "me" reference for person_id
    let personId = params.person_id;
    if (personId === 'me') {
      if (!config?.PRODUCTIVE_USER_ID) {
        throw new McpError(ErrorCode.InvalidParams, 'Cannot use "me" reference - PRODUCTIVE_USER_ID is not configured');
      }
      personId = config.PRODUCTIVE_USER_ID;
    }

    const amountInCents = dollarsToCents(params.amount);
    const billableInCents = params.billable_amount ? dollarsToCents(params.billable_amount) : undefined;

    if (!params.confirm) {
      return {
        content: [{
          type: 'text',
          text: `Expense Ready to Create:

Name: ${params.name}
Amount: $${params.amount} ${params.currency} (${amountInCents} cents)
Date: ${params.date}
Service ID: ${params.service_id}
${personId ? `Person ID: ${personId}` : 'No person specified'}

To create this expense, call this tool again with the same parameters and add "confirm": true`,
        }],
      };
    }

    const expenseData: ProductiveExpenseCreate = {
      data: {
        type: 'expenses',
        attributes: {
          name: params.name,
          amount: amountInCents,
          currency: params.currency,
          date: params.date,
          ...(billableInCents && { billable_amount: billableInCents }),
        },
        relationships: {
          service: { data: { id: params.service_id, type: 'services' } },
          ...(personId && { person: { data: { id: personId, type: 'people' } } }),
        },
      },
    };

    const response = await client.createExpense(expenseData);

    // Convert cents back to dollars for display
    const displayAmount = (parseFloat(response.data.attributes.amount) / 100).toFixed(2);

    return {
      content: [{
        type: 'text',
        text: `Expense created successfully!
ID: ${response.data.id}
Name: ${response.data.attributes.name}
Amount: $${displayAmount} ${response.data.attributes.currency}
Date: ${response.data.attributes.date}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createExpenseDefinition = {
  name: 'create_expense',
  description: 'Create an expense in Productive.io. Use this to record contractor costs against a project budget. Requires a service_id from the project deal hierarchy (list_project_deals → list_deal_services). Pass amount in DOLLARS (e.g. "1500.00") — it will be converted to cents for the API. Two-step confirmation: first call previews, second call with confirm: true creates.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Expense description (e.g. "Richard Flett - Jan 2026 contractor invoice")' },
      amount: { type: 'string', description: 'Cost amount in DOLLARS as string (e.g. "1500.00"). Converted to cents internally.' },
      billable_amount: { type: 'string', description: 'Billable amount in DOLLARS if different from cost (optional)' },
      currency: { type: 'string', description: 'Currency code (e.g. "NZD", "AUD", "USD")' },
      date: { type: 'string', description: 'Expense date (YYYY-MM-DD)' },
      service_id: { type: 'string', description: 'Service ID from deal hierarchy (required)' },
      person_id: { type: 'string', description: 'Person ID (optional). Use "me" for configured user.' },
      confirm: { type: 'boolean', description: 'Set to true to confirm and create. First call without to preview.', default: false },
    },
    required: ['name', 'amount', 'currency', 'date', 'service_id'],
  },
};

// --- Delete Expense ---

const deleteExpenseSchema = z.object({
  id: z.string().min(1, 'Expense ID is required'),
});

export async function deleteExpenseTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteExpenseSchema.parse(args);
    await client.deleteExpense(params.id);
    return { content: [{ type: 'text', text: `Expense ${params.id} deleted successfully.` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteExpenseDefinition = {
  name: 'delete_expense',
  description: 'Delete an expense from Productive.io.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Expense ID to delete (required)' },
    },
    required: ['id'],
  },
};
