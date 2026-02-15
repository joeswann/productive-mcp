import { Config } from '../config/index.js';
import {
  ProductiveCompany,
  ProductiveProject,
  ProductiveTask,
  ProductiveBoard,
  ProductiveTaskList,
  ProductivePerson,
  ProductiveActivity,
  ProductiveComment,
  ProductiveWorkflowStatus,
  ProductiveService,
  ProductiveTimeEntry,
  ProductiveDeal,
  ProductiveResponse,
  ProductiveSingleResponse,
  ProductiveTaskCreate,
  ProductiveTaskUpdate,
  ProductiveBoardCreate,
  ProductiveTaskListCreate,
  ProductiveCommentCreate,
  ProductiveTimeEntryCreate,
  ProductiveProjectCreate,
  ProductiveProjectUpdate,
  ProductiveDealCreate,
  ProductiveDealUpdate,
  ProductiveBoardUpdate,
  ProductiveTaskListUpdate,
  ProductiveTimeEntryUpdate,
  ProductiveDealStatus,
  ProductiveWorkflow,
  ProductiveError,
  ProductiveDocumentType,
  ProductiveInvoice,
  ProductiveInvoiceCreate,
  ProductiveInvoiceUpdate,
  ProductiveInvoiceAttribution,
  ProductiveInvoiceAttributionCreate,
  ProductiveLineItem,
  ProductiveLineItemCreate,
  ProductivePage,
  ProductivePageCreate,
  ProductivePageUpdate,
  ProductiveExpense,
  ProductiveExpenseCreate,
  ProductiveRateCard,
  ProductiveRateCardCreate,
  ProductivePrice,
  ProductivePriceCreate,
  ProductivePriceUpdate,
  ProductiveTodo,
  ProductiveTodoCreate,
  ProductiveTodoUpdate,
  ProductiveBooking,
  ProductiveBookingCreate,
  ProductiveBookingUpdate,
  ProductiveReportEntry,
} from './types.js';

export class ProductiveAPIClient {
  private config: Config;
  
  constructor(config: Config) {
    this.config = config;
  }
  
  private getHeaders(): HeadersInit {
    return {
      'X-Auth-Token': this.config.PRODUCTIVE_API_TOKEN,
      'X-Organization-Id': this.config.PRODUCTIVE_ORG_ID,
      'Content-Type': 'application/vnd.api+json',
    };
  }
  
  private async makeRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.PRODUCTIVE_API_BASE_URL}${path}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options?.headers,
        },
      });
      
      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}`;
        try {
          const errorData = await response.json() as ProductiveError;
          errorMessage = errorData.errors?.[0]?.detail || errorMessage;
        } catch { /* non-JSON error body */ }
        throw new Error(errorMessage);
      }
      
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T;
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while making API request');
    }
  }
  
  async listCompanies(params?: {
    status?: 'active' | 'archived';
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveCompany>> {
    const queryParams = new URLSearchParams();
    
    if (params?.status) {
      queryParams.append('filter[status]', params.status);
    }
    
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `companies${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveCompany>>(path);
  }
  
  async listProjects(params?: {
    status?: 'active' | 'archived';
    company_id?: string;
    template?: boolean;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveProject>> {
    const queryParams = new URLSearchParams();

    if (params?.status) {
      // Convert status string to integer: active = 1, archived = 2
      const statusValue = params.status === 'active' ? '1' : '2';
      queryParams.append('filter[status]', statusValue);
    }

    if (params?.company_id) {
      queryParams.append('filter[company_id]', params.company_id);
    }

    if (params?.template !== undefined) {
      queryParams.append('filter[template]', params.template ? '1' : '0');
    }
    
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `projects${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveProject>>(path);
  }
  
  async createProject(projectData: ProductiveProjectCreate): Promise<ProductiveSingleResponse<ProductiveProject>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveProject>>('projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async createDeal(dealData: ProductiveDealCreate): Promise<ProductiveSingleResponse<ProductiveDeal>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveDeal>>('deals', {
      method: 'POST',
      body: JSON.stringify(dealData),
    });
  }

  async copyDeal(data: Record<string, unknown>): Promise<ProductiveSingleResponse<ProductiveDeal>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveDeal>>('deals/copy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createService(data: Record<string, unknown>): Promise<ProductiveSingleResponse<ProductiveService>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveService>>('services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async copyProject(data: Record<string, unknown>): Promise<ProductiveSingleResponse<ProductiveProject>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveProject>>('projects/copy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: ProductiveProjectUpdate): Promise<ProductiveSingleResponse<ProductiveProject>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveProject>>(`projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async restoreProject(id: string): Promise<ProductiveSingleResponse<ProductiveProject>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveProject>>(`projects/${id}/restore`, {
      method: 'PATCH',
    });
  }

  async archiveProject(id: string): Promise<ProductiveSingleResponse<ProductiveProject>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveProject>>(`projects/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  }

  async updateDeal(id: string, data: ProductiveDealUpdate): Promise<ProductiveSingleResponse<ProductiveDeal>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveDeal>>(`deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async openDeal(id: string): Promise<ProductiveSingleResponse<ProductiveDeal>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveDeal>>(`deals/${id}/open`, {
      method: 'PATCH',
    });
  }

  async updateBoard(id: string, data: ProductiveBoardUpdate): Promise<ProductiveSingleResponse<ProductiveBoard>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveBoard>>(`boards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateTaskList(id: string, data: ProductiveTaskListUpdate): Promise<ProductiveSingleResponse<ProductiveTaskList>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTaskList>>(`task_lists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateTimeEntry(id: string, data: ProductiveTimeEntryUpdate): Promise<ProductiveSingleResponse<ProductiveTimeEntry>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTimeEntry>>(`time_entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ── Get single resource methods ──

  async getProject(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveProject>> {
    const query = params?.include ? `?include=${params.include}` : '';
    return this.makeRequest<ProductiveSingleResponse<ProductiveProject>>(`projects/${id}${query}`);
  }

  async getBoard(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveBoard>> {
    const query = params?.include ? `?include=${params.include}` : '';
    return this.makeRequest<ProductiveSingleResponse<ProductiveBoard>>(`boards/${id}${query}`);
  }

  async getTaskList(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveTaskList>> {
    const query = params?.include ? `?include=${params.include}` : '';
    return this.makeRequest<ProductiveSingleResponse<ProductiveTaskList>>(`task_lists/${id}${query}`);
  }

  async getDeal(id: string): Promise<ProductiveSingleResponse<ProductiveDeal>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveDeal>>(
      `deals/${id}?fields[deals]=name,budget,budget_type,date,currency,value,total_value,invoiced_amount,cost,profit,probability,delivered_on,closed_at,note,created_at,updated_at&include=deal_status,project`
    );
  }

  async getCompany(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveCompany>> {
    const query = params?.include ? `?include=${params.include}` : '';
    return this.makeRequest<ProductiveSingleResponse<ProductiveCompany>>(`companies/${id}${query}`);
  }

  async getService(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveService>> {
    const query = params?.include ? `?include=${params.include}` : '';
    return this.makeRequest<ProductiveSingleResponse<ProductiveService>>(`services/${id}${query}`);
  }

  async getPerson(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductivePerson>> {
    const query = params?.include ? `?include=${params.include}` : '';
    return this.makeRequest<ProductiveSingleResponse<ProductivePerson>>(`people/${id}${query}`);
  }

  // ── Delete methods ──

  async deleteProject(id: string): Promise<void> {
    await this.makeRequest<void>(`projects/${id}`, { method: 'DELETE' });
  }

  async deleteBoard(id: string): Promise<void> {
    await this.makeRequest<void>(`boards/${id}`, { method: 'DELETE' });
  }

  async deleteTaskList(id: string): Promise<void> {
    await this.makeRequest<void>(`task_lists/${id}`, { method: 'DELETE' });
  }

  async deleteTask(id: string): Promise<void> {
    await this.makeRequest<void>(`tasks/${id}`, { method: 'DELETE' });
  }

  async deleteTimeEntry(id: string): Promise<void> {
    await this.makeRequest<void>(`time_entries/${id}`, { method: 'DELETE' });
  }

  async deleteDeal(id: string): Promise<void> {
    await this.makeRequest<void>(`deals/${id}`, { method: 'DELETE' });
  }

  async listWorkflows(params?: {
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveWorkflow>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    const queryString = queryParams.toString();
    const path = `workflows${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest<ProductiveResponse<ProductiveWorkflow>>(path);
  }

  async listDealStatuses(params?: {
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveDealStatus>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    const queryString = queryParams.toString();
    const path = `deal_statuses${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest<ProductiveResponse<ProductiveDealStatus>>(path);
  }

  async listTasks(params?: {
    project_id?: string;
    assignee_id?: string;
    status?: 'open' | 'closed';
    closed_after?: string;
    closed_before?: string;
    last_activity_after?: string;
    last_activity_before?: string;
    sort?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveTask>> {
    const queryParams = new URLSearchParams();

    if (params?.project_id) {
      queryParams.append('filter[project_id]', params.project_id);
    }

    if (params?.assignee_id) {
      queryParams.append('filter[assignee_id]', params.assignee_id);
    }

    if (params?.status) {
      // Convert status names to integers: open = 1, closed = 2
      const statusValue = params.status === 'open' ? '1' : '2';
      queryParams.append('filter[status]', statusValue);
    }

    if (params?.closed_after) {
      queryParams.append('filter[closed_after]', params.closed_after);
    }

    if (params?.closed_before) {
      queryParams.append('filter[closed_before]', params.closed_before);
    }

    if (params?.last_activity_after) {
      queryParams.append('filter[last_activity_after]', params.last_activity_after);
    }

    if (params?.last_activity_before) {
      queryParams.append('filter[last_activity_before]', params.last_activity_before);
    }

    if (params?.sort) {
      queryParams.append('sort', params.sort);
    }

    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }

    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }

    // Include relationships needed for display
    // Note: Productive API uses 'assignee' (singular), not 'assignees'
    queryParams.append('include', 'assignee,workflow_status,project');

    const queryString = queryParams.toString();
    const path = `tasks${queryString ? `?${queryString}` : ''}`;

    return this.makeRequest<ProductiveResponse<ProductiveTask>>(path);
  }
  
  async listBoards(params?: {
    project_id?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveBoard>> {
    const queryParams = new URLSearchParams();
    
    if (params?.project_id) {
      queryParams.append('filter[project_id]', params.project_id);
    }
    
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `boards${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveBoard>>(path);
  }
  
  async createBoard(boardData: ProductiveBoardCreate): Promise<ProductiveSingleResponse<ProductiveBoard>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveBoard>>('boards', {
      method: 'POST',
      body: JSON.stringify(boardData),
    });
  }
  
  async createTask(taskData: ProductiveTaskCreate): Promise<ProductiveSingleResponse<ProductiveTask>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTask>>('tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }
  
  async listTaskLists(params?: {
    board_id?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveTaskList>> {
    const queryParams = new URLSearchParams();
    
    if (params?.board_id) {
      queryParams.append('filter[board_id]', params.board_id);
    }
    
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `task_lists${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveTaskList>>(path);
  }
  
  async createTaskList(taskListData: ProductiveTaskListCreate): Promise<ProductiveSingleResponse<ProductiveTaskList>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTaskList>>('task_lists', {
      method: 'POST',
      body: JSON.stringify(taskListData),
    });
  }
  
  async listPeople(params?: {
    company_id?: string;
    project_id?: string;
    is_active?: boolean;
    email?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductivePerson>> {
    const queryParams = new URLSearchParams();
    
    if (params?.company_id) {
      queryParams.append('filter[company_id]', params.company_id);
    }
    
    if (params?.project_id) {
      queryParams.append('filter[project_id]', params.project_id);
    }
    
    if (params?.is_active !== undefined) {
      queryParams.append('filter[is_active]', params.is_active.toString());
    }
    
    if (params?.email) {
      queryParams.append('filter[email]', params.email);
    }
    
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `people${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductivePerson>>(path);
  }
  
  async getTask(taskId: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveTask>> {
    const query = params?.include ? `?include=${params.include}` : '';
    return this.makeRequest<ProductiveSingleResponse<ProductiveTask>>(`tasks/${taskId}${query}`);
  }

  async updateTask(taskId: string, taskData: ProductiveTaskUpdate): Promise<ProductiveSingleResponse<ProductiveTask>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTask>>(`tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(taskData),
    });
  }

  async listActivities(params?: {
    task_id?: string;
    project_id?: string;
    person_id?: string;
    creator_id?: string;
    company_id?: string;
    item_type?: string;
    event?: string;
    after?: string; // ISO 8601 date string
    before?: string; // ISO 8601 date string
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveActivity>> {
    const queryParams = new URLSearchParams();

    // Include creator relationship for display
    queryParams.append('include', 'creator');

    if (params?.task_id) {
      queryParams.append('filter[task_id]', params.task_id);
    }

    if (params?.project_id) {
      queryParams.append('filter[project_id]', params.project_id);
    }

    if (params?.person_id) {
      queryParams.append('filter[person_id]', params.person_id);
    }

    if (params?.creator_id) {
      queryParams.append('filter[creator_id]', params.creator_id);
    }

    if (params?.company_id) {
      queryParams.append('filter[company_id]', params.company_id);
    }

    if (params?.item_type) {
      queryParams.append('filter[item_type]', params.item_type);
    }

    if (params?.event) {
      queryParams.append('filter[event]', params.event);
    }

    if (params?.after) {
      queryParams.append('filter[after]', params.after);
    }

    if (params?.before) {
      queryParams.append('filter[before]', params.before);
    }

    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }

    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }

    const queryString = queryParams.toString();
    const path = `activities${queryString ? `?${queryString}` : ''}`;

    return this.makeRequest<ProductiveResponse<ProductiveActivity>>(path);
  }

  async deleteComment(id: string): Promise<void> {
    await this.makeRequest<void>(`comments/${id}`, { method: 'DELETE' });
  }

  async createComment(commentData: ProductiveCommentCreate): Promise<ProductiveSingleResponse<ProductiveComment>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveComment>>('comments', {
      method: 'POST',
      body: JSON.stringify(commentData),
    });
  }

  async listWorkflowStatuses(params?: {
    workflow_id?: string;
    category_id?: number;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveWorkflowStatus>> {
    const queryParams = new URLSearchParams();
    
    if (params?.workflow_id) {
      queryParams.append('filter[workflow_id]', params.workflow_id);
    }
    
    if (params?.category_id) {
      queryParams.append('filter[category_id]', params.category_id.toString());
    }
    
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `workflow_statuses${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveWorkflowStatus>>(path);
  }

  /**
   * List time entries with optional filters
   * 
   * @param params - Filter parameters for time entries
   * @param params.date - Filter by specific date (ISO format: YYYY-MM-DD)
   * @param params.after - Filter entries after this date (ISO format: YYYY-MM-DD)
   * @param params.before - Filter entries before this date (ISO format: YYYY-MM-DD)
   * @param params.person_id - Filter by person ID
   * @param params.project_id - Filter by project ID
   * @param params.task_id - Filter by task ID
   * @param params.service_id - Filter by service ID
   * @param params.limit - Number of results per page
   * @param params.page - Page number for pagination
   * @returns Promise resolving to paginated time entries response
   * 
   * @example
   * // Get time entries for a specific person and date range
   * const entries = await client.listTimeEntries({
   *   person_id: "123",
   *   after: "2023-01-01",
   *   before: "2023-01-31"
   * });
   */
  async listTimeEntries(params?: {
    date?: string;
    after?: string;
    before?: string;
    person_id?: string;
    project_id?: string;
    task_id?: string;
    service_id?: string;
    company_id?: string;
    sort?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveTimeEntry>> {
    const queryParams = new URLSearchParams();

    // Include relationships by default
    queryParams.append('include', 'person,service,task');

    // Default sort by date descending (most recent first)
    queryParams.append('sort', params?.sort || '-date');

    if (params?.date) {
      queryParams.append('filter[date]', params.date);
    }

    if (params?.after) {
      queryParams.append('filter[after]', params.after);
    }

    if (params?.before) {
      queryParams.append('filter[before]', params.before);
    }

    if (params?.person_id) {
      queryParams.append('filter[person_id]', params.person_id);
    }

    if (params?.project_id) {
      queryParams.append('filter[project_id]', params.project_id);
    }

    if (params?.task_id) {
      queryParams.append('filter[task_id]', params.task_id);
    }

    if (params?.service_id) {
      queryParams.append('filter[service_id]', params.service_id);
    }

    if (params?.company_id) {
      queryParams.append('filter[company_id]', params.company_id);
    }

    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }

    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }

    const queryString = queryParams.toString();
    const path = `time_entries${queryString ? `?${queryString}` : ''}`;

    return this.makeRequest<ProductiveResponse<ProductiveTimeEntry>>(path);
  }

  /**
   * Create a new time entry
   * 
   * @param timeEntryData - Time entry creation data
   * @returns Promise resolving to the created time entry
   * 
   * @example
   * // Create a time entry for a task
   * const timeEntry = await client.createTimeEntry({
   *   data: {
   *     type: 'time_entries',
   *     attributes: {
   *       date: '2023-01-15',
   *       time: 120, // 2 hours in minutes
   *       note: 'Working on feature implementation'
   *     },
   *     relationships: {
   *       person: { data: { id: '123', type: 'people' } },
   *       service: { data: { id: '456', type: 'services' } },
   *       task: { data: { id: '789', type: 'tasks' } }
   *     }
   *   }
   * });
   */
  async createTimeEntry(timeEntryData: ProductiveTimeEntryCreate): Promise<ProductiveSingleResponse<ProductiveTimeEntry>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTimeEntry>>('time_entries', {
      method: 'POST',
      body: JSON.stringify(timeEntryData),
    });
  }

  /**
   * List deals/budgets for a specific project
   * 
   * @param params - Filter parameters for deals
   * @param params.project_id - Filter by project ID (required)
   * @param params.budget_type - Filter by budget type (1: deal, 2: budget)
   * @param params.limit - Number of results per page
   * @param params.page - Page number for pagination
   * @returns Promise resolving to paginated deals response
   * 
   * @example
   * // Get all deals/budgets for a project
   * const deals = await client.listProjectDeals({
   *   project_id: '123',
   *   budget_type: 2 // Only budgets
   * });
   */
  async listProjectDeals(params: {
    project_id: string;
    budget_type?: number; // 1: deal, 2: budget
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveDeal>> {
    const queryParams = new URLSearchParams();
    
    // Include project relationship
    queryParams.append('include', 'project');
    
    // Filter by project - deals endpoint expects array format
    queryParams.append('filter[project_id]', params.project_id);
    
    if (params.budget_type) {
      queryParams.append('filter[budget_type]', params.budget_type.toString());
    }
    
    if (params.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `deals${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveDeal>>(path);
  }

  /**
   * List services available for a specific deal/budget
   * 
   * @param params - Filter parameters for services
   * @param params.deal_id - Filter by deal/budget ID
   * @param params.limit - Number of results per page
   * @param params.page - Page number for pagination
   * @returns Promise resolving to paginated services response
   * 
   * @example
   * // Get services for a specific deal/budget
   * const services = await client.listDealServices({
   *   deal_id: '456'
   * });
   */
  async listDealServices(params: {
    deal_id: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveService>> {
    const queryParams = new URLSearchParams();
    
    // Filter by deal/budget
    queryParams.append('filter[deal_id]', params.deal_id);
    
    if (params.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `services${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveService>>(path);
  }

  /**
   * List services available for time tracking
   * 
   * @param params - Filter parameters for services
   * @param params.company_id - Filter by company ID
   * @param params.limit - Number of results per page
   * @param params.page - Page number for pagination
   * @returns Promise resolving to paginated services response
   * 
   * @example
   * // Get all services
   * const services = await client.listServices({
   *   company_id: '123'
   * });
   */
  async listServices(params?: {
    company_id?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveService>> {
    const queryParams = new URLSearchParams();
    
    if (params?.company_id) {
      queryParams.append('filter[company_id]', params.company_id);
    }
    
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    
    const queryString = queryParams.toString();
    const path = `services${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ProductiveResponse<ProductiveService>>(path);
  }

  async updateService(id: string, attributes: Record<string, unknown>): Promise<ProductiveSingleResponse<ProductiveService>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveService>>(`services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'services',
          id,
          attributes,
        },
      }),
    });
  }

  /**
   * Get a specific time entry by ID
   * 
   * @param timeEntryId - The ID of the time entry to retrieve
   * @returns Promise resolving to the time entry
   * 
   * @example
   * const timeEntry = await client.getTimeEntry('123');
   */
  async getTimeEntry(timeEntryId: string): Promise<ProductiveSingleResponse<ProductiveTimeEntry>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTimeEntry>>(`time_entries/${timeEntryId}`);
  }

  /**
   * Helper method to get time entries for a specific date range
   * Convenience wrapper around listTimeEntries with date filtering
   * 
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param endDate - End date in ISO format (YYYY-MM-DD)
   * @param additionalParams - Additional filter parameters
   * @returns Promise resolving to paginated time entries response
   * 
   * @example
   * // Get all time entries for last week
   * const entries = await client.getTimeEntriesInDateRange(
   *   '2023-01-01', 
   *   '2023-01-07',
   *   { person_id: '123' }
   * );
   */
  async getTimeEntriesInDateRange(
    startDate: string,
    endDate: string,
    additionalParams?: {
      person_id?: string;
      project_id?: string;
      task_id?: string;
      service_id?: string;
      limit?: number;
      page?: number;
    }
  ): Promise<ProductiveResponse<ProductiveTimeEntry>> {
    return this.listTimeEntries({
      after: startDate,
      before: endDate,
      ...additionalParams
    });
  }

  /**
   * Helper method to get time entries for today
   * Convenience wrapper for getting current day's time entries
   * 
   * @param additionalParams - Additional filter parameters
   * @returns Promise resolving to paginated time entries response
   * 
   * @example
   * // Get today's time entries for a specific person
   * const todayEntries = await client.getTodayTimeEntries({
   *   person_id: '123'
   * });
   */
  async getTodayTimeEntries(additionalParams?: {
    person_id?: string;
    project_id?: string;
    task_id?: string;
    service_id?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveTimeEntry>> {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    return this.listTimeEntries({
      date: today,
      ...additionalParams
    });
  }

  /**
   * Reposition a task in a task list
   * 
   * @param taskId - ID of the task to reposition
   * @param attributes - Positioning attributes (move_before_id and/or move_after_id)
   * @returns Promise resolving to the task response
   * 
   * @example
   * // Position task 1 after task 2
   * await client.repositionTask('1', { move_after_id: '2' });
   * 
   * // Position task 3 between tasks 1 and 2
   * await client.repositionTask('3', { move_after_id: '1', move_before_id: '2' });
   */
  async repositionTask(
    taskId: string,
    attributes: {
      move_before_id?: string;
      move_after_id?: string;
      placement?: number;
    }
  ): Promise<ProductiveSingleResponse<ProductiveTask> | undefined> {
    const requestBody = {
      data: {
        type: 'tasks',
        attributes: { ...attributes }
      }
    };

    return this.makeRequest<ProductiveSingleResponse<ProductiveTask> | undefined>(
      `tasks/${taskId}/reposition`,
      {
        method: 'PATCH',
        body: JSON.stringify(requestBody),
      }
    );
  }

  // ── Tax rates ──

  async listTaxRates(params?: {
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<{ id: string; type: string; attributes: Record<string, unknown> }>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    const queryString = queryParams.toString();
    const path = `tax_rates${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest(path);
  }

  // ── Invoice methods ──

  async listDocumentTypes(params?: {
    exportable_type_id?: number;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveDocumentType>> {
    const queryParams = new URLSearchParams();
    if (params?.exportable_type_id) {
      queryParams.append('filter[exportable_type_id]', params.exportable_type_id.toString());
    }
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    const queryString = queryParams.toString();
    const path = `document_types${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest<ProductiveResponse<ProductiveDocumentType>>(path);
  }

  async listInvoices(params?: {
    company_id?: string;
    deal_id?: string;
    project_id?: string;
    invoice_status?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveInvoice>> {
    const queryParams = new URLSearchParams();
    queryParams.append('include', 'company,document_type');
    if (params?.company_id) {
      queryParams.append('filter[company_id]', params.company_id);
    }
    if (params?.deal_id) {
      queryParams.append('filter[deal_id]', params.deal_id);
    }
    if (params?.project_id) {
      queryParams.append('filter[project_id]', params.project_id);
    }
    if (params?.invoice_status) {
      queryParams.append('filter[invoice_status]', params.invoice_status);
    }
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    const queryString = queryParams.toString();
    const path = `invoices${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest<ProductiveResponse<ProductiveInvoice>>(path);
  }

  async getInvoice(id: string): Promise<ProductiveSingleResponse<ProductiveInvoice>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveInvoice>>(`invoices/${id}?include=company,document_type`);
  }

  async createInvoice(data: ProductiveInvoiceCreate): Promise<ProductiveSingleResponse<ProductiveInvoice>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveInvoice>>('invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInvoice(id: string, data: ProductiveInvoiceUpdate): Promise<ProductiveSingleResponse<ProductiveInvoice>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveInvoice>>(`invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createPayment(invoiceId: string, paidOn: string, amount: string): Promise<unknown> {
    return this.makeRequest<unknown>('payments', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'payments',
          attributes: { paid_on: paidOn, amount },
          relationships: {
            invoice: { data: { type: 'invoices', id: invoiceId } },
          },
        },
      }),
    });
  }

  async listPayments(invoiceId: string): Promise<{ data: Array<{ id: string; attributes: Record<string, unknown>; relationships?: Record<string, unknown> }> }> {
    return this.makeRequest(`payments?filter[invoice_id]=${invoiceId}`);
  }

  async deletePayment(paymentId: string): Promise<unknown> {
    return this.makeRequest(`payments/${paymentId}`, {
      method: 'DELETE',
    });
  }

  async listInvoiceAttributions(params?: {
    invoice_id?: string;
    budget_id?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveInvoiceAttribution>> {
    const queryParams = new URLSearchParams();
    queryParams.append('include', 'invoice,budget');
    if (params?.invoice_id) {
      queryParams.append('filter[invoice_id]', params.invoice_id);
    }
    if (params?.budget_id) {
      queryParams.append('filter[budget_id]', params.budget_id);
    }
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    const queryString = queryParams.toString();
    const path = `invoice_attributions${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest<ProductiveResponse<ProductiveInvoiceAttribution>>(path);
  }

  async createInvoiceAttribution(data: ProductiveInvoiceAttributionCreate): Promise<ProductiveSingleResponse<ProductiveInvoiceAttribution>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveInvoiceAttribution>>('invoice_attributions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteInvoice(id: string): Promise<void> {
    await this.makeRequest<void>(`invoices/${id}`, { method: 'DELETE' });
  }

  async deleteInvoiceAttribution(id: string): Promise<void> {
    await this.makeRequest<void>(`invoice_attributions/${id}`, { method: 'DELETE' });
  }

  async createLineItem(data: ProductiveLineItemCreate): Promise<ProductiveSingleResponse<ProductiveLineItem>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveLineItem>>('line_items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Page/Doc methods ──

  async createPage(data: ProductivePageCreate): Promise<ProductiveSingleResponse<ProductivePage>> {
    return this.makeRequest<ProductiveSingleResponse<ProductivePage>>('pages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePage(id: string, data: ProductivePageUpdate): Promise<ProductiveSingleResponse<ProductivePage>> {
    return this.makeRequest<ProductiveSingleResponse<ProductivePage>>(`pages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePage(id: string): Promise<void> {
    await this.makeRequest<void>(`pages/${id}`, { method: 'DELETE' });
  }

  async listPages(params?: {
    project_id?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductivePage>> {
    const queryParams = new URLSearchParams();
    if (params?.project_id) {
      queryParams.append('filter[project_id]', params.project_id);
    }
    if (params?.limit) {
      queryParams.append('page[size]', params.limit.toString());
    }
    if (params?.page) {
      queryParams.append('page[number]', params.page.toString());
    }
    const queryString = queryParams.toString();
    const path = `pages${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest<ProductiveResponse<ProductivePage>>(path);
  }

  async finalizeInvoice(id: string): Promise<ProductiveSingleResponse<ProductiveInvoice>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveInvoice>>(`invoices/${id}/finalize`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  }

  // ── Expense methods ──

  async listExpenses(params?: {
    service_id?: string;
    person_id?: string;
    deal_id?: string;
    date_after?: string;
    date_before?: string;
    approval_status?: string;
    sort?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveExpense>> {
    const queryParams = new URLSearchParams();
    queryParams.append('include', 'service,person,deal');
    queryParams.append('sort', params?.sort || '-date');
    if (params?.service_id) queryParams.append('filter[service_id]', params.service_id);
    if (params?.person_id) queryParams.append('filter[person_id]', params.person_id);
    if (params?.deal_id) queryParams.append('filter[deal_id]', params.deal_id);
    if (params?.date_after) queryParams.append('filter[date_after]', params.date_after);
    if (params?.date_before) queryParams.append('filter[date_before]', params.date_before);
    if (params?.approval_status) queryParams.append('filter[approval_status]', params.approval_status);
    if (params?.limit) queryParams.append('page[size]', params.limit.toString());
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    const queryString = queryParams.toString();
    return this.makeRequest<ProductiveResponse<ProductiveExpense>>(`expenses?${queryString}`);
  }

  async createExpense(data: ProductiveExpenseCreate): Promise<ProductiveSingleResponse<ProductiveExpense>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveExpense>>('expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(id: string): Promise<void> {
    await this.makeRequest<void>(`expenses/${id}`, { method: 'DELETE' });
  }

  // ── Rate Card methods ──

  async listRateCards(params?: {
    company_id?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveRateCard>> {
    const queryParams = new URLSearchParams();
    queryParams.append('include', 'company');
    if (params?.company_id) queryParams.append('filter[company_id]', params.company_id);
    if (params?.limit) queryParams.append('page[size]', params.limit.toString());
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    const queryString = queryParams.toString();
    return this.makeRequest<ProductiveResponse<ProductiveRateCard>>(`rate_cards?${queryString}`);
  }

  async getRateCard(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveRateCard>> {
    const query = params?.include ? `?include=${params.include}` : '?include=company';
    return this.makeRequest<ProductiveSingleResponse<ProductiveRateCard>>(`rate_cards/${id}${query}`);
  }

  async createRateCard(data: ProductiveRateCardCreate): Promise<ProductiveSingleResponse<ProductiveRateCard>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveRateCard>>('rate_cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRateCard(id: string, data: { data: { type: 'rate_cards'; id: string; attributes?: { name?: string } } }): Promise<ProductiveSingleResponse<ProductiveRateCard>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveRateCard>>(`rate_cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRateCard(id: string): Promise<void> {
    await this.makeRequest<void>(`rate_cards/${id}`, { method: 'DELETE' });
  }

  async archiveRateCard(id: string): Promise<ProductiveSingleResponse<ProductiveRateCard>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveRateCard>>(`rate_cards/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  }

  async restoreRateCard(id: string): Promise<ProductiveSingleResponse<ProductiveRateCard>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveRateCard>>(`rate_cards/${id}/restore`, {
      method: 'PATCH',
    });
  }

  // ── Price methods ──

  async listPrices(params?: {
    rate_card_id?: string;
    company_id?: string;
    service_type_id?: string;
    time_tracking_enabled?: boolean;
    booking_tracking_enabled?: boolean;
    expense_tracking_enabled?: boolean;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductivePrice>> {
    const queryParams = new URLSearchParams();
    queryParams.append('include', 'rate_card,company,service_type');
    if (params?.rate_card_id) queryParams.append('filter[rate_card_id]', params.rate_card_id);
    if (params?.company_id) queryParams.append('filter[company_id]', params.company_id);
    if (params?.service_type_id) queryParams.append('filter[service_type_id]', params.service_type_id);
    if (params?.time_tracking_enabled !== undefined) queryParams.append('filter[time_tracking_enabled]', params.time_tracking_enabled.toString());
    if (params?.booking_tracking_enabled !== undefined) queryParams.append('filter[booking_tracking_enabled]', params.booking_tracking_enabled.toString());
    if (params?.expense_tracking_enabled !== undefined) queryParams.append('filter[expense_tracking_enabled]', params.expense_tracking_enabled.toString());
    if (params?.limit) queryParams.append('page[size]', params.limit.toString());
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    const queryString = queryParams.toString();
    return this.makeRequest<ProductiveResponse<ProductivePrice>>(`prices?${queryString}`);
  }

  async getPrice(id: string): Promise<ProductiveSingleResponse<ProductivePrice>> {
    return this.makeRequest<ProductiveSingleResponse<ProductivePrice>>(`prices/${id}?include=rate_card,company,service_type`);
  }

  async createPrice(data: ProductivePriceCreate): Promise<ProductiveSingleResponse<ProductivePrice>> {
    return this.makeRequest<ProductiveSingleResponse<ProductivePrice>>('prices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePrice(id: string, data: ProductivePriceUpdate): Promise<ProductiveSingleResponse<ProductivePrice>> {
    return this.makeRequest<ProductiveSingleResponse<ProductivePrice>>(`prices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePrice(id: string): Promise<void> {
    await this.makeRequest<void>(`prices/${id}`, { method: 'DELETE' });
  }

  // ── Todo methods ──

  async listTodos(params?: {
    task_id?: string;
    deal_id?: string;
    assignee_id?: string;
    status?: number; // 1=open, 2=closed
    due_date?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveTodo>> {
    const queryParams = new URLSearchParams();
    queryParams.append('include', 'assignee,task,deal');
    if (params?.task_id) queryParams.append('filter[task_id]', params.task_id);
    if (params?.deal_id) queryParams.append('filter[deal_id]', params.deal_id);
    if (params?.assignee_id) queryParams.append('filter[assignee_id]', params.assignee_id);
    if (params?.status) queryParams.append('filter[status]', params.status.toString());
    if (params?.due_date) queryParams.append('filter[due_date]', params.due_date);
    if (params?.limit) queryParams.append('page[size]', params.limit.toString());
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    const queryString = queryParams.toString();
    return this.makeRequest<ProductiveResponse<ProductiveTodo>>(`todos?${queryString}`);
  }

  async createTodo(data: ProductiveTodoCreate): Promise<ProductiveSingleResponse<ProductiveTodo>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTodo>>('todos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTodo(id: string, data: ProductiveTodoUpdate): Promise<ProductiveSingleResponse<ProductiveTodo>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveTodo>>(`todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTodo(id: string): Promise<void> {
    await this.makeRequest<void>(`todos/${id}`, { method: 'DELETE' });
  }

  // ── Booking methods ──

  async listBookings(params?: {
    person_id?: string;
    project_id?: string;
    service_id?: string;
    event_id?: string;
    task_id?: string;
    started_on?: string;
    ended_on?: string;
    after?: string;
    before?: string;
    draft?: boolean;
    booking_type?: string; // 'event' or 'service'
    sort?: string;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveBooking>> {
    const queryParams = new URLSearchParams();
    queryParams.append('include', 'person,service,event,task');
    queryParams.append('sort', params?.sort || '-started_on');
    if (params?.person_id) queryParams.append('filter[person_id]', params.person_id);
    if (params?.project_id) queryParams.append('filter[project_id]', params.project_id);
    if (params?.service_id) queryParams.append('filter[service_id]', params.service_id);
    if (params?.event_id) queryParams.append('filter[event_id]', params.event_id);
    if (params?.task_id) queryParams.append('filter[task_id]', params.task_id);
    if (params?.started_on) queryParams.append('filter[started_on]', params.started_on);
    if (params?.ended_on) queryParams.append('filter[ended_on]', params.ended_on);
    if (params?.after) queryParams.append('filter[after]', params.after);
    if (params?.before) queryParams.append('filter[before]', params.before);
    if (params?.draft !== undefined) queryParams.append('filter[draft]', params.draft.toString());
    if (params?.booking_type) queryParams.append('filter[booking_type]', params.booking_type);
    if (params?.limit) queryParams.append('page[size]', params.limit.toString());
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    const queryString = queryParams.toString();
    return this.makeRequest<ProductiveResponse<ProductiveBooking>>(`bookings?${queryString}`);
  }

  async getBooking(id: string, params?: { include?: string }): Promise<ProductiveSingleResponse<ProductiveBooking>> {
    const query = params?.include ? `?include=${params.include}` : '?include=person,service,event,task';
    return this.makeRequest<ProductiveSingleResponse<ProductiveBooking>>(`bookings/${id}${query}`);
  }

  async createBooking(data: ProductiveBookingCreate): Promise<ProductiveSingleResponse<ProductiveBooking>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveBooking>>('bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBooking(id: string, data: ProductiveBookingUpdate): Promise<ProductiveSingleResponse<ProductiveBooking>> {
    return this.makeRequest<ProductiveSingleResponse<ProductiveBooking>>(`bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBooking(id: string): Promise<void> {
    await this.makeRequest<void>(`bookings/${id}`, { method: 'DELETE' });
  }

  // ── Report methods ──

  async getReport(reportType: string, params?: {
    group: string;
    filters?: Record<string, string>;
    limit?: number;
    page?: number;
  }): Promise<ProductiveResponse<ProductiveReportEntry>> {
    const queryParams = new URLSearchParams();
    if (params?.group) queryParams.append('group', params.group);
    if (params?.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        queryParams.append(`filter[${key}]`, value);
      }
    }
    if (params?.limit) queryParams.append('page[size]', params.limit.toString());
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    const queryString = queryParams.toString();
    return this.makeRequest<ProductiveResponse<ProductiveReportEntry>>(`reports/${reportType}?${queryString}`);
  }
}
