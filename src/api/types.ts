export interface ProductiveCompany {
  id: string;
  type: 'companies';
  attributes: {
    name: string;
    billing_name?: string;
    vat?: string;
    default_currency?: string;
    company_code?: string;
    domain?: string;
    description?: string;
    tag_list?: string[];
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    [key: string]: unknown;
  };
}

export interface ProductiveProject {
  id: string;
  type: 'projects';
  attributes: {
    name: string;
    description?: string;
    status: 'active' | 'archived';
    archived_at?: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    company?: {
      data: {
        id: string;
        type: 'companies';
      };
    };
    [key: string]: unknown;
  };
}

export interface ProductiveTask {
  id: string;
  type: 'tasks';
  attributes: {
    title: string;
    description?: string;
    status?: number; // 1 = open, 2 = closed (for API requests)
    closed?: boolean; // false = open, true = closed (from API responses)
    due_date?: string;
    priority?: number;
    placement?: number;
    task_number?: number;
    private?: boolean;
    initial_estimate?: number;
    worked_time?: number;
    last_activity_at?: string;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    project?: {
      data: {
        id: string;
        type: 'projects';
      };
    };
    assignee?: {
      data: {
        id: string;
        type: 'people';
      };
    };
    task_list?: {
      data: {
        id: string;
        type: 'task_lists';
      };
    };
    workflow_status?: {
      data: {
        id: string;
        type: 'workflow_statuses';
      };
    };
    [key: string]: unknown;
  };
}

export interface ProductiveIncludedResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export interface ProductiveResponse<T> {
  data: T[];
  included?: ProductiveIncludedResource[];
  links?: {
    first?: string;
    last?: string;
    prev?: string;
    next?: string;
  };
  meta?: {
    current_page?: number;
    total_pages?: number;
    total_count?: number;
  };
}

export interface ProductiveBoard {
  id: string;
  type: 'boards';
  attributes: {
    name: string;
    description?: string;
    position?: number;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    project?: {
      data: {
        id: string;
        type: 'projects';
      };
    };
    [key: string]: unknown;
  };
}

export interface ProductiveTaskCreate {
  data: {
    type: 'tasks';
    attributes: {
      title: string;
      description?: string;
      due_date?: string;
      status?: number;
    };
    relationships?: {
      project?: {
        data: {
          id: string;
          type: 'projects';
        };
      };
      board?: {
        data: {
          id: string;
          type: 'boards';
        };
      };
      task_list?: {
        data: {
          id: string;
          type: 'task_lists';
        };
      };
      assignee?: {
        data: {
          id: string;
          type: 'people';
        };
      };
    };
  };
}

export interface ProductiveTaskList {
  id: string;
  type: 'task_lists';
  attributes: {
    name: string;
    description?: string;
    position?: number;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    board?: {
      data: {
        id: string;
        type: 'boards';
      };
    };
    [key: string]: unknown;
  };
}

export interface ProductiveBoardCreate {
  data: {
    type: 'boards';
    attributes: {
      name: string;
      description?: string;
    };
    relationships: {
      project: {
        data: {
          id: string;
          type: 'projects';
        };
      };
    };
  };
}

export interface ProductiveTaskListCreate {
  data: {
    type: 'task_lists';
    attributes: {
      name: string;
      description?: string;
      position?: number;
    };
    relationships: {
      board: {
        data: {
          id: string;
          type: 'boards';
        };
      };
      project: {
        data: {
          id: string;
          type: 'projects';
        };
      };
    };
  };
}

export interface ProductiveTaskUpdate {
  data: {
    type: 'tasks';
    id: string;
    attributes?: {
      title?: string;
      description?: string;
      due_date?: string;
      status?: number;
      custom_fields?: Record<string, unknown>;
    };
    relationships?: {
      assignee?: {
        data: {
          id: string;
          type: 'people';
        } | null;
      };
      workflow_status?: {
        data: {
          id: string;
          type: 'workflow_statuses';
        };
      };
      task_list?: {
        data: {
          id: string;
          type: 'task_lists';
        };
      };
    };
  };
}

export interface ProductiveSingleResponse<T> {
  data: T;
  included?: ProductiveIncludedResource[];
}

export interface ProductivePerson {
  id: string;
  type: 'people';
  attributes: {
    email: string;
    first_name: string;
    last_name: string;
    title?: string;
    role?: string;
    is_active?: boolean;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    company?: {
      data: {
        id: string;
        type: 'companies';
      };
    };
    [key: string]: unknown;
  };
}

export interface ProductiveActivity {
  id: string;
  type: 'activities';
  attributes: {
    event: string; // 'create', 'update', 'delete', etc.
    item_type: string; // 'Task', 'Project', 'Workspace', etc.
    item_id: string;
    changes?: Record<string, unknown>;
    created_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    organization?: {
      data: {
        id: string;
        type: 'organizations';
      };
    };
    creator?: {
      data: {
        id: string;
        type: 'people';
      };
    };
    [key: string]: unknown;
  };
}

export interface ProductiveComment {
  id: string;
  type: 'comments';
  attributes: {
    body: string;
    commentable_type: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    draft?: boolean;
    edited_at?: string;
    hidden?: boolean;
    pinned_at?: string;
    reactions?: Record<string, unknown>;
    version_number?: number;
    [key: string]: unknown;
  };
  relationships?: {
    creator?: {
      data: {
        id: string;
        type: 'people';
      };
    };
    task?: {
      data: {
        id: string;
        type: 'tasks';
      };
    };
    [key: string]: unknown;
  };
}

export interface ProductiveCommentCreate {
  data: {
    type: 'comments';
    attributes: {
      body: string;
    };
    relationships: {
      task: {
        data: {
          id: string;
          type: 'tasks';
        };
      };
    };
  };
}

export interface ProductiveWorkflowStatus {
  id: string;
  type: 'workflow_statuses';
  attributes: {
    name: string;
    color_id: number;
    position: number;
    category_id: number; // 1=not started, 2=started, 3=closed
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    workflow?: {
      data: {
        id: string;
        type: 'workflows';
      };
    };
    [key: string]: unknown;
  };
}

/**
 * Service entity interface for Productive API
 * Services represent billable activities/work types in Productive
 */
export interface ProductiveService {
  id: string;
  type: 'services';
  attributes: {
    name: string;
    description?: string;
    is_active?: boolean;
    billing_type_id?: number; // 1=Fixed, 2=Time & Materials, 3=Not Billable
    unit_id?: number; // 1=Hour, 2=Piece, 3=Day
    price?: number; // Price in cents
    quantity?: number;
    billable?: boolean;
    worked_time?: number;
    budgeted_time?: number;
    revenue?: number;
    expense_tracking_enabled?: boolean;
    time_tracking_enabled?: boolean;
    booking_tracking_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    company?: {
      data: {
        id: string;
        type: 'companies';
      };
    };
    deal?: {
      data: {
        id: string;
        type: 'deals';
      };
    };
    [key: string]: unknown;
  };
}

/**
 * Time entry entity interface for Productive API
 * Represents logged time against tasks or projects
 */
export interface ProductiveTimeEntry {
  id: string;
  type: 'time_entries';
  attributes: {
    date: string; // ISO date format (YYYY-MM-DD)
    time: number; // Time in minutes
    billable_time?: number; // Billable time in minutes, defaults to time value
    note?: string; // Description of work performed
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    person?: {
      data: {
        id: string;
        type: 'people';
      };
    };
    service?: {
      data: {
        id: string;
        type: 'services';
      };
    };
    task?: {
      data: {
        id: string;
        type: 'tasks';
      };
    };
    project?: {
      data: {
        id: string;
        type: 'projects';
      };
    };
    [key: string]: unknown;
  };
}

/**
 * Deal/Budget entity representing project budgets or deals
 */
export interface ProductiveDeal {
  id: string;
  type: 'deals';
  attributes: {
    name: string;
    budget_type?: number; // 1: deal, 2: budget
    value?: number;
    total_value?: number;
    invoiced_amount?: number;
    cost?: number;
    profit?: number;
    probability?: number;
    budget?: boolean;
    currency?: string;
    date?: string;
    delivered_on?: string;
    closed_at?: string | null;
    note?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
  relationships?: {
    project?: {
      data?: {
        id: string;
        type: 'projects';
      };
    };
    services?: {
      data?: Array<{
        id: string;
        type: 'services';
      }>;
    };
    deal_status?: {
      data?: {
        id: string;
        type: 'deal_statuses';
      };
    };
    [key: string]: unknown;
  };
}

/**
 * Time entry creation interface for Productive API
 * Used when creating new time entries via POST requests
 */
export interface ProductiveTimeEntryCreate {
  data: {
    type: 'time_entries';
    attributes: {
      date: string; // ISO date format (YYYY-MM-DD)
      time: number; // Time in minutes (required)
      billable_time?: number; // Billable time in minutes, defaults to time value
      note?: string; // Description of work performed
    };
    relationships: {
      person: {
        data: {
          id: string;
          type: 'people';
        };
      };
      service: {
        data: {
          id: string;
          type: 'services';
        };
      };
      task?: {
        data: {
          id: string;
          type: 'tasks';
        };
      };
      project?: {
        data: {
          id: string;
          type: 'projects';
        };
      };
    };
  };
}

export interface ProductiveProjectCreate {
  data: {
    type: 'projects';
    attributes: {
      name: string;
      description?: string;
      project_type_id: number; // 1=internal, 2=client
    };
    relationships: {
      company: {
        data: {
          id: string;
          type: 'companies';
        };
      };
      project_manager: {
        data: {
          id: string;
          type: 'people';
        };
      };
      workflow: {
        data: {
          id: string;
          type: 'workflows';
        };
      };
    };
  };
}

export interface ProductiveWorkflow {
  id: string;
  type: 'workflows';
  attributes: {
    name: string;
    archived_at?: string | null;
    [key: string]: unknown;
  };
}

export interface ProductiveDealStatus {
  id: string;
  type: 'deal_statuses';
  attributes: {
    name: string;
    position: number;
    status_id: number; // 1=active, 2=won, 3=lost
    color_id?: number;
    time_tracking_enabled?: boolean;
    expense_tracking_enabled?: boolean;
    archived_at?: string | null;
    [key: string]: unknown;
  };
}

export interface ProductiveDealCreate {
  data: {
    type: 'deals';
    attributes: {
      name: string;
      date: string; // YYYY-MM-DD
      deal_type_id: number;
      deal_status_id?: number;
      probability?: number;
      currency?: string;
      budget?: boolean; // true = budget, false = deal
    };
    relationships: {
      company: {
        data: {
          id: string;
          type: 'companies';
        };
      };
      responsible: {
        data: {
          id: string;
          type: 'people';
        };
      };
      project?: {
        data: {
          id: string;
          type: 'projects';
        };
      };
    };
  };
}

export interface ProductiveProjectUpdate {
  data: {
    type: 'projects';
    id: string;
    attributes?: {
      name?: string;
      project_manager_id?: number;
      project_type_id?: number;
      project_color_id?: number;
      workflow_id?: number;
      preferences?: Record<string, unknown>;
    };
    relationships?: {
      company?: {
        data: {
          id: string;
          type: 'companies';
        };
      };
    };
  };
}

export interface ProductiveDealUpdate {
  data: {
    type: 'deals';
    id: string;
    attributes?: {
      name?: string;
      date?: string;
      probability?: number;
      currency?: string;
      deal_status_id?: number;
      budget_type?: number;
      note?: string;
      value?: string;
      closed_at?: string | null;
    };
    relationships?: {
      company?: {
        data: {
          id: string;
          type: 'companies';
        };
      };
      responsible?: {
        data: {
          id: string;
          type: 'people';
        };
      };
      project?: {
        data: {
          id: string;
          type: 'projects';
        };
      };
    };
  };
}

export interface ProductiveBoardUpdate {
  data: {
    type: 'boards';
    id: string;
    attributes?: {
      name?: string;
    };
  };
}

export interface ProductiveTaskListUpdate {
  data: {
    type: 'task_lists';
    id: string;
    attributes?: {
      name?: string;
    };
  };
}

export interface ProductiveTimeEntryUpdate {
  data: {
    type: 'time_entries';
    id: string;
    attributes?: {
      date?: string;
      time?: number;
      billable_time?: number;
      note?: string;
    };
    relationships?: {
      task?: {
        data: { id: string; type: 'tasks' } | null;
      };
      service?: {
        data: { id: string; type: 'services' };
      };
      [key: string]: { data: { id: string; type: string } | null } | undefined;
    };
  };
}

// Invoice types

export interface ProductiveDocumentType {
  id: string;
  type: 'document_types';
  attributes: {
    name: string;
    locale?: string;
    exportable_type_id?: number;
    archived_at?: string | null;
    [key: string]: unknown;
  };
}

export interface ProductiveInvoice {
  id: string;
  type: 'invoices';
  attributes: {
    number?: string;
    subject?: string;
    invoiced_on: string;
    pay_on?: string;
    paid_on?: string;
    currency: string;
    amount?: string;
    amount_tax?: string;
    amount_with_tax?: string;
    amount_paid?: string;
    amount_unpaid?: string;
    note?: string;
    footer?: string;
    purchase_order_number?: string;
    tag_list?: string[];
    exported?: boolean;
    export_integration_type_id?: number;
    export_id?: string;
    export_invoice_url?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
  relationships?: {
    company?: { data: { id: string; type: 'companies' } };
    document_type?: { data: { id: string; type: 'document_types' } };
    [key: string]: unknown;
  };
}

export interface ProductiveInvoiceCreate {
  data: {
    type: 'invoices';
    attributes: {
      invoiced_on: string;
      currency: string;
      subject?: string;
      number?: string;
      pay_on?: string;
      note?: string;
      footer?: string;
      purchase_order_number?: string;
      tag_list?: string[];
      export_invoice_url?: string;
      exported?: boolean;
      export_id?: string;
    };
    relationships: {
      company: { data: { id: string; type: 'companies' } };
      document_type: { data: { id: string; type: 'document_types' } };
      deal?: { data: { id: string; type: 'deals' } };
    };
  };
}

export interface ProductiveInvoiceUpdate {
  data: {
    type: 'invoices';
    id: string;
    attributes?: {
      subject?: string;
      note?: string;
      footer?: string;
      pay_on?: string;
      paid_on?: string;
      purchase_order_number?: string;
      export_invoice_url?: string;
      exported?: boolean;
      export_id?: string;
      tag_list?: string[];
    };
  };
}

export interface ProductiveInvoiceAttribution {
  id: string;
  type: 'invoice_attributions';
  attributes: {
    amount?: string;
    currency?: string;
    date_from?: string;
    date_to?: string;
    [key: string]: unknown;
  };
  relationships?: {
    invoice?: { data: { id: string; type: 'invoices' } };
    budget?: { data: { id: string; type: 'deals' } };
    [key: string]: unknown;
  };
}

export interface ProductiveInvoiceAttributionCreate {
  data: {
    type: 'invoice_attributions';
    attributes: {
      amount: string;
    };
    relationships: {
      invoice: { data: { id: string; type: 'invoices' } };
      budget: { data: { id: string; type: 'deals' } };
    };
  };
}

export interface ProductiveLineItem {
  id: string;
  type: 'line_items';
  attributes: {
    description?: string;
    quantity?: string;
    unit_price?: number;
    unit_id?: number;
    discount?: number | null;
    position?: number;
    amount?: number;
    amount_tax?: number;
    amount_with_tax?: number;
    tax_name?: string;
    tax_value?: string;
    currency?: string;
    [key: string]: unknown;
  };
  relationships?: {
    invoice?: { data: { id: string; type: 'invoices' } };
    tax_rate?: { data: { id: string; type: 'tax_rates' } };
    [key: string]: unknown;
  };
}

export interface ProductiveLineItemCreate {
  data: {
    type: 'line_items';
    attributes: {
      description: string;
      quantity: string;
      unit_price: number;
      unit_id: number;
      discount?: number | null;
      position?: number;
    };
    relationships: {
      invoice: { data: { id: string; type: 'invoices' } };
      tax_rate: { data: { id: string; type: 'tax_rates' } };
    };
  };
}

export interface ProductivePage {
  id: string;
  type: 'pages';
  attributes: {
    title: string;
    body?: string;
    created_at?: string;
    edited_at?: string;
    position?: number;
    version_number?: number;
    parent_page_id?: number;
    root_page_id?: number;
    [key: string]: unknown;
  };
  relationships?: {
    project?: { data: { id: string; type: 'projects' } };
    parent_page?: { data: { id: string; type: 'pages' } };
    root_page?: { data: { id: string; type: 'pages' } };
    [key: string]: unknown;
  };
}

export interface ProductivePageCreate {
  data: {
    type: 'pages';
    attributes: {
      title: string;
      body?: string;
    };
    relationships?: {
      project?: { data: { id: string; type: 'projects' } };
      parent_page?: { data: { id: string; type: 'pages' } };
      root_page?: { data: { id: string; type: 'pages' } };
    };
  };
}

export interface ProductivePageUpdate {
  data: {
    type: 'pages';
    id: string;
    attributes?: {
      title?: string;
      body?: string;
    };
  };
}

// Expense types

export interface ProductiveExpense {
  id: string;
  type: 'expenses';
  attributes: {
    name: string;
    amount: string;
    billable_amount?: string;
    currency: string;
    date: string;
    approved?: boolean;
    approved_at?: string;
    invoiced?: boolean;
    draft?: boolean;
    note?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
  relationships?: {
    service?: { data: { id: string; type: 'services' } };
    person?: { data: { id: string; type: 'people' } };
    deal?: { data: { id: string; type: 'deals' } };
    [key: string]: unknown;
  };
}

export interface ProductiveExpenseCreate {
  data: {
    type: 'expenses';
    attributes: {
      name: string;
      amount: string;
      billable_amount?: string;
      currency: string;
      date: string;
    };
    relationships: {
      service: { data: { id: string; type: 'services' } };
      person?: { data: { id: string; type: 'people' } };
    };
  };
}

// Rate Card types

export interface ProductiveRateCard {
  id: string;
  type: 'rate_cards';
  attributes: {
    name: string;
    created_at: string;
    updated_at: string;
    archived_at?: string | null;
    prices_count?: number;
    [key: string]: unknown;
  };
  relationships?: {
    company?: { data: { id: string; type: 'companies' } };
    creator?: { data: { id: string; type: 'people' } };
    [key: string]: unknown;
  };
}

export interface ProductiveRateCardCreate {
  data: {
    type: 'rate_cards';
    attributes: {
      name: string;
    };
    relationships: {
      company: { data: { id: string; type: 'companies' } };
    };
  };
}

// Price types

export interface ProductivePrice {
  id: string;
  type: 'prices';
  attributes: {
    name: string;
    unit_id?: number;
    rate?: number;
    currency?: string;
    quantity?: number;
    billing_type_id?: number;
    description?: string;
    discount?: number;
    markup?: number;
    time_tracking_enabled?: boolean;
    booking_tracking_enabled?: boolean;
    expense_tracking_enabled?: boolean;
    budget_cap_enabled?: boolean;
    estimated_hours?: number;
    estimated_cost?: number;
    updated_at?: string;
    [key: string]: unknown;
  };
  relationships?: {
    rate_card?: { data: { id: string; type: 'rate_cards' } };
    company?: { data: { id: string; type: 'companies' } };
    service_type?: { data: { id: string; type: 'service_types' } };
    [key: string]: unknown;
  };
}

export interface ProductivePriceCreate {
  data: {
    type: 'prices';
    attributes: {
      name: string;
      unit_id: number;
      rate: number;
      currency: string;
      quantity?: number;
      billing_type_id?: number;
      description?: string;
      discount?: number;
      markup?: number;
      time_tracking_enabled?: boolean;
      booking_tracking_enabled?: boolean;
      expense_tracking_enabled?: boolean;
    };
    relationships: {
      company: { data: { id: string; type: 'companies' } };
      service_type: { data: { id: string; type: 'service_types' } };
      rate_card: { data: { id: string; type: 'rate_cards' } };
    };
  };
}

export interface ProductivePriceUpdate {
  data: {
    type: 'prices';
    id: string;
    attributes?: {
      name?: string;
      rate?: number;
      currency?: string;
      quantity?: number;
      billing_type_id?: number;
      description?: string;
      discount?: number;
      markup?: number;
      time_tracking_enabled?: boolean;
      booking_tracking_enabled?: boolean;
      expense_tracking_enabled?: boolean;
    };
  };
}

// Todo types

export interface ProductiveTodo {
  id: string;
  type: 'todos';
  attributes: {
    description: string;
    closed?: boolean;
    closed_at?: string | null;
    due_date?: string | null;
    due_time?: string | null;
    position?: number;
    created_at: string;
    todoable_type?: string;
    [key: string]: unknown;
  };
  relationships?: {
    assignee?: { data: { id: string; type: 'people' } };
    task?: { data: { id: string; type: 'tasks' } };
    deal?: { data: { id: string; type: 'deals' } };
    [key: string]: unknown;
  };
}

export interface ProductiveTodoCreate {
  data: {
    type: 'todos';
    attributes: {
      description: string;
      due_date?: string;
      due_time?: string;
    };
    relationships: {
      assignee: { data: { id: string; type: 'people' } };
      task?: { data: { id: string; type: 'tasks' } };
      deal?: { data: { id: string; type: 'deals' } };
    };
  };
}

export interface ProductiveTodoUpdate {
  data: {
    type: 'todos';
    id: string;
    attributes?: {
      description?: string;
      closed?: boolean;
      due_date?: string | null;
    };
  };
}

// Booking types

export interface ProductiveBooking {
  id: string;
  type: 'bookings';
  attributes: {
    started_on: string;
    ended_on: string;
    time?: number; // minutes per day
    total_time?: number; // total minutes
    percentage?: number;
    booking_method_id?: number; // 1=Per day, 2=Percentage, 3=Total hours
    note?: string;
    draft?: boolean;
    approved?: boolean;
    approved_at?: string | null;
    rejected?: boolean;
    rejected_reason?: string | null;
    canceled?: boolean;
    autotracking?: boolean;
    custom_fields?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
  relationships?: {
    person?: { data: { id: string; type: 'people' } };
    service?: { data: { id: string; type: 'services' } };
    event?: { data: { id: string; type: 'events' } };
    task?: { data: { id: string; type: 'tasks' } };
    [key: string]: unknown;
  };
}

export interface ProductiveBookingCreate {
  data: {
    type: 'bookings';
    attributes: {
      started_on: string;
      ended_on: string;
      time?: number;
      total_time?: number;
      percentage?: number;
      booking_method_id?: number;
      note?: string;
      draft?: boolean;
    };
    relationships: {
      person: { data: { id: string; type: 'people' } };
      service?: { data: { id: string; type: 'services' } };
      event?: { data: { id: string; type: 'events' } };
      task?: { data: { id: string; type: 'tasks' } };
    };
  };
}

export interface ProductiveBookingUpdate {
  data: {
    type: 'bookings';
    id: string;
    attributes?: {
      started_on?: string;
      ended_on?: string;
      time?: number;
      total_time?: number;
      percentage?: number;
      note?: string;
      draft?: boolean;
    };
  };
}

// Report types (read-only, generic structure)

export interface ProductiveReportEntry {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export interface ProductiveError {
  errors: Array<{
    status?: string;
    title?: string;
    detail?: string;
    source?: {
      pointer?: string;
      parameter?: string;
    };
  }>;
}

/**
 * Task reposition interface for Productive API
 * Used when repositioning tasks in a task list
 */
export interface TaskReposition {
  move_before_id?: string; // Move task before specified task ID
  move_after_id?: string;  // Move task after specified task ID
  placement?: number;      // Legacy parameter, not recommended
}
