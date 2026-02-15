import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ProductiveInvoiceCreate, ProductiveInvoiceUpdate, ProductiveInvoiceAttributionCreate, ProductiveLineItemCreate } from '../api/types.js';

// --- List Document Types ---

const listDocumentTypesSchema = z.object({
  exportable_type_id: z.number().int().optional().describe('Filter by type: 1=invoice, 2=deal, 3=budget'),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listDocumentTypesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listDocumentTypesSchema.parse(args || {});

    const response = await client.listDocumentTypes({
      exportable_type_id: params.exportable_type_id,
      limit: params.limit,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text', text: 'No document types found.' }],
      };
    }

    const text = response.data.map(dt => {
      const archived = dt.attributes.archived_at ? ' (archived)' : '';
      return `- ${dt.attributes.name} (ID: ${dt.id})${archived}${dt.attributes.locale ? ` [${dt.attributes.locale}]` : ''}`;
    }).join('\n');

    return {
      content: [{
        type: 'text',
        text: `Found ${response.data.length} document type(s):\n\n${text}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listDocumentTypesDefinition = {
  name: 'list_document_types',
  description: 'PREREQUISITE: List available document types (invoice templates) to find the document_type_id required by create_invoice. Our org uses document_type_id 153925 (GST 15%, NZD, en_US). Filter with exportable_type_id=1 for invoice templates only.',
  inputSchema: {
    type: 'object',
    properties: {
      exportable_type_id: { type: 'number', description: 'Filter by type: 1=invoice, 2=deal, 3=budget' },
      limit: { type: 'number', description: 'Max results (1-200)', minimum: 1, maximum: 200, default: 30 },
    },
  },
};

// --- List Invoices ---

const listInvoicesSchema = z.object({
  company_id: z.string().optional().describe('Filter by company ID'),
  deal_id: z.string().optional().describe('Filter by deal/budget ID'),
  project_id: z.string().optional().describe('Filter by project ID'),
  invoice_status: z.string().optional().describe('Filter by status'),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().int().min(1).optional(),
});

export async function listInvoicesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listInvoicesSchema.parse(args || {});

    const response = await client.listInvoices({
      company_id: params.company_id,
      deal_id: params.deal_id,
      project_id: params.project_id,
      invoice_status: params.invoice_status,
      limit: params.limit,
      page: params.page,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text', text: 'No invoices found.' }],
      };
    }

    const text = response.data.map(inv => {
      const num = inv.attributes.number ? `#${inv.attributes.number}` : '(no number)';
      const subject = inv.attributes.subject || '(no subject)';
      const amount = inv.attributes.amount_with_tax ? ` ${inv.attributes.currency} ${inv.attributes.amount_with_tax}` : '';
      const xeroUrl = inv.attributes.export_invoice_url ? `\n  Xero: ${inv.attributes.export_invoice_url}` : '';
      const companyId = inv.relationships?.company?.data?.id;

      return `- ${num} — ${subject} (ID: ${inv.id})${amount}\n  Date: ${inv.attributes.invoiced_on}${companyId ? `\n  Company ID: ${companyId}` : ''}${xeroUrl}`;
    }).join('\n\n');

    const total = response.meta?.total_count ? ` (${response.meta.total_count} total)` : '';
    return {
      content: [{
        type: 'text',
        text: `Found ${response.data.length} invoice(s)${total}:\n\n${text}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listInvoicesDefinition = {
  name: 'list_invoices',
  description: 'List invoices in Productive.io. Filter by company, deal/budget, project, or status. Shows amounts, dates, and Xero links if set.',
  inputSchema: {
    type: 'object',
    properties: {
      company_id: { type: 'string', description: 'Filter by company ID' },
      deal_id: { type: 'string', description: 'Filter by deal/budget ID' },
      project_id: { type: 'string', description: 'Filter by project ID' },
      invoice_status: { type: 'string', description: 'Filter by invoice status' },
      limit: { type: 'number', description: 'Max results (1-200)', minimum: 1, maximum: 200, default: 30 },
      page: { type: 'number', description: 'Page number', minimum: 1 },
    },
  },
};

// --- Get Invoice ---

const getInvoiceSchema = z.object({
  id: z.string().min(1, 'Invoice ID is required'),
});

export async function getInvoiceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getInvoiceSchema.parse(args);
    const response = await client.getInvoice(params.id);
    const inv = response.data;

    const lines: string[] = [
      `Invoice ${inv.attributes.number ? `#${inv.attributes.number}` : '(no number)'} (ID: ${inv.id})`,
      inv.attributes.subject ? `Subject: ${inv.attributes.subject}` : '',
      `Date: ${inv.attributes.invoiced_on}`,
      `Currency: ${inv.attributes.currency}`,
      inv.attributes.amount ? `Amount: ${inv.attributes.amount}` : '',
      inv.attributes.amount_tax ? `Tax: ${inv.attributes.amount_tax}` : '',
      inv.attributes.amount_with_tax ? `Total: ${inv.attributes.amount_with_tax}` : '',
      inv.attributes.amount_paid ? `Paid: ${inv.attributes.amount_paid}` : '',
      inv.attributes.amount_unpaid ? `Unpaid: ${inv.attributes.amount_unpaid}` : '',
      inv.attributes.pay_on ? `Due: ${inv.attributes.pay_on}` : '',
      inv.attributes.paid_on ? `Paid on: ${inv.attributes.paid_on}` : '',
      inv.attributes.note ? `Note: ${inv.attributes.note}` : '',
      inv.attributes.purchase_order_number ? `PO: ${inv.attributes.purchase_order_number}` : '',
      inv.attributes.export_invoice_url ? `Xero URL: ${inv.attributes.export_invoice_url}` : '',
      inv.relationships?.company?.data?.id ? `Company ID: ${inv.relationships.company.data.id}` : '',
      inv.relationships?.document_type?.data?.id ? `Document Type ID: ${inv.relationships.document_type.data.id}` : '',
    ].filter(Boolean);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getInvoiceDefinition = {
  name: 'get_invoice',
  description: 'Get a single invoice by ID from Productive.io.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Invoice ID (required)' },
    },
    required: ['id'],
  },
};

// --- Delete Invoice ---

const deleteInvoiceSchema = z.object({
  id: z.string().min(1, 'Invoice ID is required'),
});

export async function deleteInvoiceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteInvoiceSchema.parse(args);
    await client.deleteInvoice(params.id);
    return {
      content: [{ type: 'text', text: `Invoice ${params.id} deleted successfully.` }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteInvoiceDefinition = {
  name: 'delete_invoice',
  description: 'Delete an invoice from Productive.io. Note: finalized invoices may not be deletable via API.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Invoice ID to delete (required)' },
    },
    required: ['id'],
  },
};

// --- Create Invoice ---

const createInvoiceSchema = z.object({
  company_id: z.string().min(1, 'Company ID is required'),
  document_type_id: z.string().min(1, 'Document type ID is required'),
  invoiced_on: z.string().min(1, 'Invoice date is required').describe('YYYY-MM-DD'),
  currency: z.string().default('NZD'),
  subject: z.string().optional(),
  number: z.string().optional().describe('Invoice number (e.g. "INV-0365")'),
  pay_on: z.string().optional().describe('Due date (YYYY-MM-DD)'),
  note: z.string().optional(),
  footer: z.string().optional(),
  purchase_order_number: z.string().optional(),
  xero_invoice_url: z.string().optional().describe('URL to the corresponding Xero invoice. Auto-sets exported=true and extracts the Xero UUID as export_id.'),
  xero_invoice_id: z.string().optional().describe('Xero invoice UUID (auto-extracted from xero_invoice_url if not provided)'),
  deal_id: z.string().optional().describe('Deal/budget ID — if provided with amount, auto-creates an invoice attribution'),
  amount: z.string().optional().describe('Amount for the invoice attribution (required if deal_id is provided)'),
});

export async function createInvoiceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createInvoiceSchema.parse(args);

    if (params.deal_id && !params.amount) {
      throw new McpError(ErrorCode.InvalidParams, 'amount is required when deal_id is provided (for invoice attribution)');
    }

    // Extract Xero UUID from URL or use explicit param
    let xeroId = params.xero_invoice_id;
    if (!xeroId && params.xero_invoice_url) {
      const match = params.xero_invoice_url.match(/InvoiceID=([0-9a-f-]+)/i);
      if (match) xeroId = match[1];
    }

    const invoiceData: ProductiveInvoiceCreate = {
      data: {
        type: 'invoices',
        attributes: {
          invoiced_on: params.invoiced_on,
          currency: params.currency,
          ...(params.subject && { subject: params.subject }),
          ...(params.number && { number: params.number }),
          ...(params.pay_on && { pay_on: params.pay_on }),
          ...(params.note && { note: params.note }),
          ...(params.footer && { footer: params.footer }),
          ...(params.purchase_order_number && { purchase_order_number: params.purchase_order_number }),
          ...(params.xero_invoice_url && { export_invoice_url: params.xero_invoice_url, exported: true }),
          ...(xeroId && { export_id: xeroId }),
        },
        relationships: {
          company: { data: { id: params.company_id, type: 'companies' } },
          document_type: { data: { id: params.document_type_id, type: 'document_types' } },
          ...(params.deal_id && { deal: { data: { id: params.deal_id, type: 'deals' } } }),
        },
      },
    };

    const response = await client.createInvoice(invoiceData);
    const inv = response.data;

    const lines: string[] = [
      'Invoice created successfully!',
      '',
      `ID: ${inv.id}`,
      inv.attributes.number ? `Number: ${inv.attributes.number}` : '',
      inv.attributes.subject ? `Subject: ${inv.attributes.subject}` : '',
      `Date: ${inv.attributes.invoiced_on}`,
      `Currency: ${inv.attributes.currency}`,
      `Company ID: ${params.company_id}`,
      params.xero_invoice_url ? `Xero URL: ${params.xero_invoice_url}` : '',
    ].filter(Boolean);

    // Auto-create invoice attribution if deal_id and amount provided
    if (params.deal_id && params.amount) {
      const attrData: ProductiveInvoiceAttributionCreate = {
        data: {
          type: 'invoice_attributions',
          attributes: {
            amount: params.amount,
          },
          relationships: {
            invoice: { data: { id: inv.id, type: 'invoices' } },
            budget: { data: { id: params.deal_id, type: 'deals' } },
          },
        },
      };

      const attrResponse = await client.createInvoiceAttribution(attrData);
      lines.push('');
      lines.push(`Invoice attribution created (ID: ${attrResponse.data.id})`);
      lines.push(`  Linked to budget: ${params.deal_id}`);
      lines.push(`  Amount: ${params.amount}`);
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createInvoiceDefinition = {
  name: 'create_invoice',
  description: 'STEP 1 of invoice workflow: Create a new draft invoice (starts at $0). FULL WORKFLOW: 1) create_invoice → 2) create_line_item (gives it amounts + tax) → 3) link_invoice_to_budget (connects to deal, attribution amount MUST match invoice total) → 4) finalize_invoice (one-way, locks it). Optionally provide xero_invoice_url to store a link to the corresponding Xero invoice. If deal_id and amount are provided, auto-creates the invoice attribution (step 3).',
  inputSchema: {
    type: 'object',
    properties: {
      company_id: { type: 'string', description: 'Company ID (required)' },
      document_type_id: { type: 'string', description: 'Document type ID (required). Use list_document_types to find available templates.' },
      invoiced_on: { type: 'string', description: 'Invoice date in YYYY-MM-DD format (required)' },
      currency: { type: 'string', description: 'Currency code (default: NZD)', default: 'NZD' },
      subject: { type: 'string', description: 'Invoice subject/title' },
      number: { type: 'string', description: 'Invoice number (e.g. "INV-0365")' },
      pay_on: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
      note: { type: 'string', description: 'Invoice note' },
      footer: { type: 'string', description: 'Invoice footer text' },
      purchase_order_number: { type: 'string', description: 'Purchase order number' },
      xero_invoice_url: { type: 'string', description: 'URL to the Xero invoice (stored in export_invoice_url)' },
      deal_id: { type: 'string', description: 'Deal/budget ID to link via invoice attribution (requires amount)' },
      amount: { type: 'string', description: 'Amount for the invoice attribution (required if deal_id is set)' },
    },
    required: ['company_id', 'document_type_id', 'invoiced_on'],
  },
};

// --- Update Invoice ---

const updateInvoiceSchema = z.object({
  id: z.string().min(1, 'Invoice ID is required'),
  subject: z.string().optional(),
  note: z.string().optional(),
  footer: z.string().optional(),
  pay_on: z.string().optional(),
  paid_on: z.string().optional().describe('Date paid (YYYY-MM-DD). Creates a payment record — paid_on is read-only on the invoice itself.'),
  purchase_order_number: z.string().optional(),
  xero_invoice_url: z.string().optional().describe('URL to the Xero invoice (stored in export_invoice_url)'),
  tag_list: z.array(z.string()).optional(),
});

export async function updateInvoiceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateInvoiceSchema.parse(args);

    const attributes: ProductiveInvoiceUpdate['data']['attributes'] = {};
    if (params.subject !== undefined) attributes.subject = params.subject;
    if (params.note !== undefined) attributes.note = params.note;
    if (params.footer !== undefined) attributes.footer = params.footer;
    if (params.pay_on !== undefined) attributes.pay_on = params.pay_on;
    if (params.purchase_order_number !== undefined) attributes.purchase_order_number = params.purchase_order_number;
    if (params.xero_invoice_url !== undefined) {
      attributes.export_invoice_url = params.xero_invoice_url;
      attributes.exported = true;
      const match = params.xero_invoice_url.match(/InvoiceID=([0-9a-f-]+)/i);
      if (match) attributes.export_id = match[1];
    }
    if (params.tag_list !== undefined) attributes.tag_list = params.tag_list;

    // paid_on is read-only on invoices — create a payment record instead.
    // Do NOT send paid_on as an invoice attribute (causes ghost $0 payments).
    if (params.paid_on !== undefined) {
      const invoiceResp = await client.getInvoice(params.id);
      const unpaid = Number(invoiceResp.data.attributes.amount_unpaid);
      if (!isNaN(unpaid) && unpaid > 0) {
        // Use amount_unpaid to handle partial payments correctly
        await client.createPayment(params.id, params.paid_on, String(invoiceResp.data.attributes.amount_unpaid));
      } else if (isNaN(unpaid)) {
        // amount_unpaid not available — fall back to full total for new payment
        const total = invoiceResp.data.attributes.amount_with_tax || invoiceResp.data.attributes.amount;
        if (Number(total) > 0) {
          await client.createPayment(params.id, params.paid_on, String(total));
        }
      }
      // If unpaid <= 0, invoice is already fully paid — skip
    }

    let inv;
    if (Object.keys(attributes).length > 0) {
      const updateData: ProductiveInvoiceUpdate = {
        data: {
          type: 'invoices',
          id: params.id,
          attributes,
        },
      };
      const response = await client.updateInvoice(params.id, updateData);
      inv = response.data;
    } else {
      const response = await client.getInvoice(params.id);
      inv = response.data;
    }

    const changes: string[] = [];
    if (params.subject !== undefined) changes.push(`Subject: ${params.subject}`);
    if (params.note !== undefined) changes.push(`Note: ${params.note}`);
    if (params.footer !== undefined) changes.push(`Footer: ${params.footer}`);
    if (params.pay_on !== undefined) changes.push(`Due date: ${params.pay_on}`);
    if (params.paid_on !== undefined) changes.push(`Payment recorded: ${params.paid_on}`);
    if (params.purchase_order_number !== undefined) changes.push(`PO: ${params.purchase_order_number}`);
    if (params.xero_invoice_url !== undefined) changes.push(`Xero URL: ${params.xero_invoice_url}`);
    if (params.tag_list !== undefined) changes.push(`Tags: ${params.tag_list.join(', ')}`);

    return {
      content: [{
        type: 'text',
        text: `Invoice ${params.id} updated successfully!\n\nNumber: ${inv.attributes.number || '(none)'}\nUpdated fields:\n${changes.map(c => `  - ${c}`).join('\n')}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateInvoiceDefinition = {
  name: 'update_invoice',
  description: 'Update an existing draft invoice. Only provide fields you want to change. Use xero_invoice_url to set or update the Xero link (stored in export_invoice_url). Note: finalized invoices have limited editability.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Invoice ID (required)' },
      subject: { type: 'string', description: 'New subject' },
      note: { type: 'string', description: 'New note' },
      footer: { type: 'string', description: 'New footer text' },
      pay_on: { type: 'string', description: 'New due date (YYYY-MM-DD)' },
      paid_on: { type: 'string', description: 'Date paid (YYYY-MM-DD)' },
      purchase_order_number: { type: 'string', description: 'New PO number' },
      xero_invoice_url: { type: 'string', description: 'URL to the Xero invoice' },
      tag_list: { type: 'array', items: { type: 'string' }, description: 'Invoice tags' },
    },
    required: ['id'],
  },
};

// --- Link Invoice to Budget ---

const linkInvoiceToBudgetSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID is required'),
  budget_id: z.string().min(1, 'Budget/deal ID is required'),
  amount: z.string().min(1, 'Amount is required'),
});

export async function linkInvoiceToBudgetTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = linkInvoiceToBudgetSchema.parse(args);

    const attrData: ProductiveInvoiceAttributionCreate = {
      data: {
        type: 'invoice_attributions',
        attributes: {
          amount: params.amount,
        },
        relationships: {
          invoice: { data: { id: params.invoice_id, type: 'invoices' } },
          budget: { data: { id: params.budget_id, type: 'deals' } },
        },
      },
    };

    const response = await client.createInvoiceAttribution(attrData);
    const attr = response.data;

    return {
      content: [{
        type: 'text',
        text: `Invoice attribution created (ID: ${attr.id})\n\nInvoice: ${params.invoice_id}\nBudget: ${params.budget_id}\nAmount: ${params.amount}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const linkInvoiceToBudgetDefinition = {
  name: 'link_invoice_to_budget',
  description: 'STEP 3 of invoice workflow: Link an invoice to a deal/budget via an invoice attribution. The amount MUST match the invoice total (sum of line items incl. tax), otherwise Productive shows "amount not correctly distributed". An invoice can have attributions to multiple budgets as long as they sum to the invoice total.',
  inputSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', description: 'Invoice ID (required)' },
      budget_id: { type: 'string', description: 'Deal/budget ID (required)' },
      amount: { type: 'string', description: 'Amount in CENTS, EX-GST (required). e.g. "90000" = $900.00. Must match the ex-tax line item total — budgets track amounts without tax.' },
    },
    required: ['invoice_id', 'budget_id', 'amount'],
  },
};

// --- Create Line Item ---

const createLineItemSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID is required'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.string().default('1'),
  unit_price: z.number().min(0, 'Unit price must be >= 0'),
  tax_rate_id: z.string().default('15943').describe('Tax rate ID (default: 15943 = NZ GST 15%)'),
  unit_id: z.number().int().default(1),
  discount: z.number().nullable().optional(),
  position: z.number().int().optional(),
});

export async function createLineItemTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createLineItemSchema.parse(args);

    const data: ProductiveLineItemCreate = {
      data: {
        type: 'line_items',
        attributes: {
          description: params.description,
          quantity: params.quantity,
          unit_price: params.unit_price,
          unit_id: params.unit_id,
          ...(params.discount !== undefined && { discount: params.discount }),
          ...(params.position !== undefined && { position: params.position }),
        },
        relationships: {
          invoice: { data: { id: params.invoice_id, type: 'invoices' } },
          tax_rate: { data: { id: params.tax_rate_id, type: 'tax_rates' } },
        },
      },
    };

    const response = await client.createLineItem(data);
    const item = response.data;

    return {
      content: [{
        type: 'text',
        text: `Line item created (ID: ${item.id})\n\nInvoice: ${params.invoice_id}\nDescription: ${params.description}\nQty: ${params.quantity} x $${(params.unit_price / 100).toFixed(2)}\nAmount: ${item.attributes.amount ?? 'N/A'}\nTax: ${item.attributes.amount_tax ?? 'N/A'}\nTotal: ${item.attributes.amount_with_tax ?? 'N/A'}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createLineItemDefinition = {
  name: 'create_line_item',
  description: 'STEP 2 of invoice workflow: Add a line item to give the invoice its actual amount. Invoice totals are computed from line items — without line items the invoice is $0. Tax defaults to NZ GST 15% (tax_rate_id=15943). The amount_with_tax in the response is what the attribution amount should match. IMPORTANT: unit_price is in CENTS — pass 90000 for $900.00.',
  inputSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', description: 'Invoice ID (required)' },
      description: { type: 'string', description: 'Line item description (required)' },
      quantity: { type: 'string', description: 'Quantity (default: "1")', default: '1' },
      unit_price: { type: 'number', description: 'Unit price excl. tax IN CENTS (required). e.g. 90000 = $900.00' },
      tax_rate_id: { type: 'string', description: 'Tax rate ID (default: 15943 = NZ GST 15%)', default: '15943' },
      unit_id: { type: 'number', description: 'Unit type ID (default: 1)', default: 1 },
      discount: { type: 'number', description: 'Discount percentage (nullable)' },
      position: { type: 'number', description: 'Position on invoice' },
    },
    required: ['invoice_id', 'description', 'unit_price'],
  },
};

// --- Finalize Invoice ---

const finalizeInvoiceSchema = z.object({
  id: z.string().min(1, 'Invoice ID is required'),
});

export async function finalizeInvoiceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = finalizeInvoiceSchema.parse(args);
    const response = await client.finalizeInvoice(params.id);
    const inv = response.data;

    return {
      content: [{
        type: 'text',
        text: `Invoice ${params.id} finalized!\n\nNumber: ${inv.attributes.number || '(auto-assigned)'}\nFinalized on: ${(inv.attributes as Record<string, unknown>).finalized_on || 'today'}\nTotal: ${inv.attributes.amount_with_tax ?? 'N/A'} ${inv.attributes.currency}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const finalizeInvoiceDefinition = {
  name: 'finalize_invoice',
  description: 'STEP 4 of invoice workflow: Finalize a draft invoice. WARNING: One-way operation — cannot be reverted via API. Finalization locks the invoice and auto-assigns a sequential number if one is not already set. Make sure line items and budget attributions are correct BEFORE finalizing.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Invoice ID to finalize (required)' },
    },
    required: ['id'],
  },
};

// --- List Payments ---

const listPaymentsSchema = z.object({
  invoice_id: z.string().describe('Invoice ID to list payments for'),
});

export async function listPaymentsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listPaymentsSchema.parse(args || {});
    const response = await client.listPayments(params.invoice_id);

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: 'No payments found for this invoice.' }] };
    }

    const lines = response.data.map(p => {
      const a = p.attributes;
      return `- Payment ${p.id}: amount=${a.amount}, paid_on=${a.paid_on}`;
    });

    return {
      content: [{ type: 'text', text: `Found ${response.data.length} payment(s):\n\n${lines.join('\n')}` }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listPaymentsDefinition = {
  name: 'list_payments',
  description: 'List payment records for an invoice.',
  inputSchema: {
    type: 'object',
    properties: {
      invoice_id: { type: 'string', description: 'Invoice ID (required)' },
    },
    required: ['invoice_id'],
  },
};

// --- Delete Payment ---

const deletePaymentSchema = z.object({
  payment_id: z.string().describe('Payment ID to delete'),
});

export async function deletePaymentTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params = deletePaymentSchema.parse(args || {});
  await client.deletePayment(params.payment_id);
  return {
    content: [{ type: 'text', text: `Payment ${params.payment_id} deleted.` }],
  };
}

export const deletePaymentDefinition = {
  name: 'delete_payment',
  description: 'Delete a payment record from an invoice.',
  inputSchema: {
    type: 'object',
    properties: {
      payment_id: { type: 'string', description: 'Payment ID to delete (required)' },
    },
    required: ['payment_id'],
  },
};
