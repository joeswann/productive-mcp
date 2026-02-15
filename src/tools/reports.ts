import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const REPORT_TYPES = [
  'booking_reports',
  'budget_reports',
  'company_reports',
  'deal_reports',
  'entitlement_reports',
  'expense_reports',
  'invoice_reports',
  'project_reports',
  'time_entry_reports',
] as const;

const getReportSchema = z.object({
  report_type: z.enum(REPORT_TYPES),
  group: z.string().describe('Comma-separated grouping fields. Examples: "person,project", "company", "person,started_on:month"'),
  filters: z.record(z.string()).optional().describe('Filter key-value pairs. Keys are filter names without "filter[]" wrapper. E.g. { "person_id": "1078079", "after": "2026-01-01" }'),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().min(1).optional(),
});

export async function getReportTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getReportSchema.parse(args);

    const response = await client.getReport(params.report_type, {
      group: params.group,
      filters: params.filters,
      limit: params.limit,
      page: params.page,
    });

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: `No results for ${params.report_type} grouped by ${params.group}.` }] };
    }

    const items = response.data.map(entry => {
      const a = entry.attributes;
      const lines: string[] = [];

      // Build a readable summary from attributes
      for (const [key, value] of Object.entries(a)) {
        if (value === null || value === undefined) continue;
        if (key === 'custom_fields' || key === 'formula_fields') continue;

        if (typeof value === 'object' && !Array.isArray(value)) {
          // Currency/nested objects — show inline
          const obj = value as Record<string, unknown>;
          const formatted = Object.entries(obj)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          if (formatted) lines.push(`  ${key}: ${formatted}`);
        } else {
          lines.push(`  ${key}: ${value}`);
        }
      }

      // Include relationship IDs for context
      if (entry.relationships) {
        for (const [key, value] of Object.entries(entry.relationships)) {
          if (!value || typeof value !== 'object') continue;
          const rel = value as { data?: { id?: string; type?: string } };
          if (rel.data?.id) {
            lines.push(`  ${key}: ${rel.data.type} ${rel.data.id}`);
          }
        }
      }

      return `• Entry ${entry.id}\n${lines.join('\n')}`;
    }).join('\n\n');

    const total = response.meta?.total_count;
    const summary = `${params.report_type} grouped by ${params.group}: ${response.data.length} result${response.data.length !== 1 ? 's' : ''}${total ? ` (showing ${response.data.length} of ${total})` : ''}\n\n${items}`;
    return { content: [{ type: 'text', text: summary }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getReportDefinition = {
  name: 'get_report',
  description: 'Get aggregated report data from Productive. Read-only. Supports multi-grouping and date-period grouping (e.g. "person,started_on:month"). Filters are inherited from the source resource type.',
  inputSchema: {
    type: 'object',
    properties: {
      report_type: {
        type: 'string',
        enum: [...REPORT_TYPES],
        description: 'Report type to query',
      },
      group: {
        type: 'string',
        description: 'Comma-separated grouping fields. Date period grouping uses colon syntax: "created_at:month", "started_on:week". Common groups by report type:\n- time_entry_reports: person, project, service, task, date:month\n- booking_reports: person, service, event\n- budget_reports: budget, company, project\n- invoice_reports: company, invoiced_on:month\n- project_reports: company, status',
      },
      filters: {
        type: 'object',
        description: 'Filter key-value pairs. Keys without "filter[]" wrapper. E.g. {"person_id": "1078079", "after": "2026-01-01"}',
        additionalProperties: { type: 'string' },
      },
      limit: { type: 'number', description: 'Results per page (1-200, default 30)', minimum: 1, maximum: 200 },
      page: { type: 'number', description: 'Page number', minimum: 1 },
    },
    required: ['report_type', 'group'],
  },
};
