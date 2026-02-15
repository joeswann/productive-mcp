import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { Config } from '../config/index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ── List Bookings ──

const listBookingsSchema = z.object({
  person_id: z.string().optional(),
  project_id: z.string().optional(),
  service_id: z.string().optional(),
  event_id: z.string().optional(),
  task_id: z.string().optional(),
  started_on: z.string().optional(),
  ended_on: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  draft: z.boolean().optional(),
  booking_type: z.enum(['event', 'service']).optional(),
  sort: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().min(1).optional(),
});

export async function listBookingsTool(
  client: ProductiveAPIClient,
  args: unknown,
  config: Config
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listBookingsSchema.parse(args || {});

    let personId = params.person_id;
    if (personId === 'me') {
      if (!config.PRODUCTIVE_USER_ID) {
        throw new McpError(ErrorCode.InvalidParams, 'Cannot use "me" reference - PRODUCTIVE_USER_ID is not configured');
      }
      personId = config.PRODUCTIVE_USER_ID;
    }

    const response = await client.listBookings({
      ...params,
      person_id: personId,
    });

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: 'No bookings found.' }] };
    }

    const includedMap = new Map<string, Record<string, unknown>>();
    if (response.included) {
      for (const inc of response.included) {
        includedMap.set(`${inc.type}:${inc.id}`, inc.attributes);
      }
    }

    const methodNames: Record<number, string> = { 1: 'Per day', 2: 'Percentage', 3: 'Total hours' };

    const items = response.data.map(b => {
      const a = b.attributes;
      const personId = b.relationships?.person?.data?.id;
      const serviceId = b.relationships?.service?.data?.id;
      const eventId = b.relationships?.event?.data?.id;
      const taskId = b.relationships?.task?.data?.id;

      const personAttrs = personId ? includedMap.get(`people:${personId}`) : undefined;
      const personName = personAttrs ? `${personAttrs.first_name} ${personAttrs.last_name}`.trim() : (personId ? `ID ${personId}` : undefined);

      let line = `• ${a.started_on} → ${a.ended_on} (ID: ${b.id})`;
      if (personName) line += `\n  Person: ${personName}`;

      // Time allocation
      const method = a.booking_method_id ? methodNames[a.booking_method_id] : undefined;
      if (a.time !== undefined && a.time !== null) {
        const hours = (a.time / 60).toFixed(1);
        line += `\n  Time: ${hours}h/day`;
      }
      if (a.total_time !== undefined && a.total_time !== null) {
        const hours = (a.total_time / 60).toFixed(1);
        line += `\n  Total: ${hours}h`;
      }
      if (a.percentage !== undefined && a.percentage !== null) {
        line += `\n  Allocation: ${a.percentage}%`;
      }
      if (method) line += ` (${method})`;

      // Status
      const statuses = [];
      if (a.draft) statuses.push('Draft');
      if (a.approved) statuses.push('Approved');
      if (a.rejected) statuses.push('Rejected');
      if (a.canceled) statuses.push('Canceled');
      if (statuses.length > 0) line += `\n  Status: ${statuses.join(', ')}`;

      // Links
      if (serviceId) {
        const svc = includedMap.get(`services:${serviceId}`);
        line += `\n  Service: ${svc?.name || `ID ${serviceId}`}`;
      }
      if (eventId) {
        const evt = includedMap.get(`events:${eventId}`);
        line += `\n  Event: ${evt?.name || `ID ${eventId}`}`;
      }
      if (taskId) {
        const task = includedMap.get(`tasks:${taskId}`);
        line += `\n  Task: ${task?.title || `ID ${taskId}`}`;
      }
      if (a.note) line += `\n  Note: ${a.note}`;

      return line;
    }).join('\n\n');

    const total = response.meta?.total_count;
    const summary = `Found ${response.data.length} booking${response.data.length !== 1 ? 's' : ''}${total ? ` (showing ${response.data.length} of ${total})` : ''}:\n\n${items}`;
    return { content: [{ type: 'text', text: summary }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listBookingsDefinition = {
  name: 'list_bookings',
  description: 'List bookings (resource scheduling/capacity planning). Use person_id "me" for your bookings. Supports date range filtering with after/before.',
  inputSchema: {
    type: 'object',
    properties: {
      person_id: { type: 'string', description: 'Filter by person ID (use "me" for yourself)' },
      project_id: { type: 'string', description: 'Filter by project ID' },
      service_id: { type: 'string', description: 'Filter by service ID' },
      event_id: { type: 'string', description: 'Filter by event ID (absence bookings)' },
      task_id: { type: 'string', description: 'Filter by task ID' },
      started_on: { type: 'string', description: 'Filter by start date (YYYY-MM-DD)' },
      ended_on: { type: 'string', description: 'Filter by end date (YYYY-MM-DD)' },
      after: { type: 'string', description: 'Filter bookings starting after date' },
      before: { type: 'string', description: 'Filter bookings starting before date' },
      draft: { type: 'boolean', description: 'Filter by draft/tentative status' },
      booking_type: { type: 'string', enum: ['event', 'service'], description: 'Filter by type: "service" (budget) or "event" (absence)' },
      sort: { type: 'string', description: 'Sort field (prefix with - for descending). Options: id, started_on, last_activity_at, draft' },
      limit: { type: 'number', description: 'Results per page (1-200, default 30)', minimum: 1, maximum: 200 },
      page: { type: 'number', description: 'Page number', minimum: 1 },
    },
  },
};

// ── Get Booking ──

const getBookingSchema = z.object({
  booking_id: z.string(),
});

export async function getBookingTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { booking_id } = getBookingSchema.parse(args);
    const response = await client.getBooking(booking_id);
    const b = response.data;
    const a = b.attributes;

    const includedMap = new Map<string, Record<string, unknown>>();
    if (response.included) {
      for (const inc of response.included) {
        includedMap.set(`${inc.type}:${inc.id}`, inc.attributes);
      }
    }

    const methodNames: Record<number, string> = { 1: 'Per day', 2: 'Percentage', 3: 'Total hours' };
    const personId = b.relationships?.person?.data?.id;
    const serviceId = b.relationships?.service?.data?.id;
    const eventId = b.relationships?.event?.data?.id;
    const taskId = b.relationships?.task?.data?.id;

    let text = `Booking: ${a.started_on} → ${a.ended_on} (ID: ${b.id})`;

    if (personId) {
      const person = includedMap.get(`people:${personId}`);
      text += `\nPerson: ${person ? `${person.first_name} ${person.last_name}`.trim() : `ID ${personId}`}`;
    }

    if (a.time !== undefined && a.time !== null) text += `\nTime: ${(a.time / 60).toFixed(1)}h/day`;
    if (a.total_time !== undefined && a.total_time !== null) text += `\nTotal: ${(a.total_time / 60).toFixed(1)}h`;
    if (a.percentage !== undefined && a.percentage !== null) text += `\nAllocation: ${a.percentage}%`;
    if (a.booking_method_id) text += `\nMethod: ${methodNames[a.booking_method_id] || a.booking_method_id}`;

    const statuses = [];
    if (a.draft) statuses.push('Draft');
    if (a.approved) statuses.push('Approved');
    if (a.rejected) statuses.push('Rejected');
    if (a.canceled) statuses.push('Canceled');
    if (statuses.length > 0) text += `\nStatus: ${statuses.join(', ')}`;

    if (serviceId) {
      const svc = includedMap.get(`services:${serviceId}`);
      text += `\nService: ${svc?.name || `ID ${serviceId}`}`;
    }
    if (eventId) {
      const evt = includedMap.get(`events:${eventId}`);
      text += `\nEvent: ${evt?.name || `ID ${eventId}`}`;
    }
    if (taskId) {
      const task = includedMap.get(`tasks:${taskId}`);
      text += `\nTask: ${task?.title || `ID ${taskId}`}`;
    }
    if (a.note) text += `\nNote: ${a.note}`;
    if (a.autotracking) text += `\nAutotracking: enabled`;

    return { content: [{ type: 'text', text }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getBookingDefinition = {
  name: 'get_booking',
  description: 'Get a single booking by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      booking_id: { type: 'string', description: 'Booking ID' },
    },
    required: ['booking_id'],
  },
};

// ── Create Booking ──

const createBookingSchema = z.object({
  person_id: z.string(),
  started_on: z.string(),
  ended_on: z.string(),
  time: z.number().optional().describe('Minutes per day (booking_method_id=1)'),
  total_time: z.number().optional().describe('Total minutes (booking_method_id=3)'),
  percentage: z.number().optional().describe('Percentage of available time (booking_method_id=2)'),
  booking_method_id: z.number().optional().describe('1=Per day, 2=Percentage, 3=Total hours'),
  service_id: z.string().optional(),
  event_id: z.string().optional(),
  task_id: z.string().optional(),
  note: z.string().optional(),
  draft: z.boolean().optional(),
});

export async function createBookingTool(
  client: ProductiveAPIClient,
  args: unknown,
  config: Config
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createBookingSchema.parse(args);

    let personId = params.person_id;
    if (personId === 'me') {
      if (!config.PRODUCTIVE_USER_ID) {
        throw new McpError(ErrorCode.InvalidParams, 'Cannot use "me" reference - PRODUCTIVE_USER_ID is not configured');
      }
      personId = config.PRODUCTIVE_USER_ID;
    }

    if (!params.service_id && !params.event_id) {
      throw new McpError(ErrorCode.InvalidParams, 'Either service_id (budget booking) or event_id (absence booking) is required');
    }

    const relationships: Record<string, { data: { id: string; type: string } }> = {
      person: { data: { id: personId, type: 'people' } },
    };
    if (params.service_id) relationships.service = { data: { id: params.service_id, type: 'services' } };
    if (params.event_id) relationships.event = { data: { id: params.event_id, type: 'events' } };
    if (params.task_id) relationships.task = { data: { id: params.task_id, type: 'tasks' } };

    const response = await client.createBooking({
      data: {
        type: 'bookings',
        attributes: {
          started_on: params.started_on,
          ended_on: params.ended_on,
          time: params.time,
          total_time: params.total_time,
          percentage: params.percentage,
          booking_method_id: params.booking_method_id,
          note: params.note,
          draft: params.draft,
        },
        relationships: relationships as { person: { data: { id: string; type: 'people' } } },
      },
    });

    const b = response.data;
    let text = `Created booking ${b.attributes.started_on} → ${b.attributes.ended_on} (ID: ${b.id})`;
    if (b.attributes.time) text += `\nTime: ${(b.attributes.time / 60).toFixed(1)}h/day`;
    if (b.attributes.total_time) text += `\nTotal: ${(b.attributes.total_time / 60).toFixed(1)}h`;
    if (b.attributes.draft) text += `\nStatus: Draft`;

    return { content: [{ type: 'text', text }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createBookingDefinition = {
  name: 'create_booking',
  description: 'Create a booking (resource allocation). Requires person_id ("me" supported), date range, time allocation, and either service_id (budget) or event_id (absence). Time values are in minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      person_id: { type: 'string', description: 'Person ID (use "me" for yourself)' },
      started_on: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
      ended_on: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      time: { type: 'number', description: 'Minutes per day (for booking_method_id=1). e.g. 480 = 8h/day' },
      total_time: { type: 'number', description: 'Total minutes (for booking_method_id=3). e.g. 2400 = 40h' },
      percentage: { type: 'number', description: 'Percentage of available time (for booking_method_id=2). e.g. 50 = half time' },
      booking_method_id: { type: 'number', description: '1=Per day, 2=Percentage, 3=Total hours' },
      service_id: { type: 'string', description: 'Service ID (for budget bookings)' },
      event_id: { type: 'string', description: 'Event ID (for absence bookings)' },
      task_id: { type: 'string', description: 'Task ID (optional link)' },
      note: { type: 'string', description: 'Note' },
      draft: { type: 'boolean', description: 'Set as draft/tentative (default false)' },
    },
    required: ['person_id', 'started_on', 'ended_on'],
  },
};

// ── Update Booking ──

const updateBookingSchema = z.object({
  booking_id: z.string(),
  started_on: z.string().optional(),
  ended_on: z.string().optional(),
  time: z.number().optional(),
  total_time: z.number().optional(),
  percentage: z.number().optional(),
  note: z.string().optional(),
  draft: z.boolean().optional(),
});

export async function updateBookingTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateBookingSchema.parse(args);
    const attributes: Record<string, unknown> = {};
    if (params.started_on !== undefined) attributes.started_on = params.started_on;
    if (params.ended_on !== undefined) attributes.ended_on = params.ended_on;
    if (params.time !== undefined) attributes.time = params.time;
    if (params.total_time !== undefined) attributes.total_time = params.total_time;
    if (params.percentage !== undefined) attributes.percentage = params.percentage;
    if (params.note !== undefined) attributes.note = params.note;
    if (params.draft !== undefined) attributes.draft = params.draft;

    const response = await client.updateBooking(params.booking_id, {
      data: {
        type: 'bookings',
        id: params.booking_id,
        attributes: attributes as { started_on?: string; ended_on?: string; time?: number; note?: string; draft?: boolean },
      },
    });

    const b = response.data;
    return { content: [{ type: 'text', text: `Updated booking ${b.attributes.started_on} → ${b.attributes.ended_on} (ID: ${b.id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateBookingDefinition = {
  name: 'update_booking',
  description: 'Update a booking. Time values are in minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      booking_id: { type: 'string', description: 'Booking ID' },
      started_on: { type: 'string', description: 'New start date' },
      ended_on: { type: 'string', description: 'New end date' },
      time: { type: 'number', description: 'New minutes per day' },
      total_time: { type: 'number', description: 'New total minutes' },
      percentage: { type: 'number', description: 'New percentage' },
      note: { type: 'string', description: 'New note' },
      draft: { type: 'boolean', description: 'Set draft status' },
    },
    required: ['booking_id'],
  },
};

// ── Delete Booking ──

const deleteBookingSchema = z.object({
  booking_id: z.string(),
});

export async function deleteBookingTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { booking_id } = deleteBookingSchema.parse(args);
    await client.deleteBooking(booking_id);
    return { content: [{ type: 'text', text: `Deleted booking ${booking_id}` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteBookingDefinition = {
  name: 'delete_booking',
  description: 'Delete a booking.',
  inputSchema: {
    type: 'object',
    properties: {
      booking_id: { type: 'string', description: 'Booking ID' },
    },
    required: ['booking_id'],
  },
};
