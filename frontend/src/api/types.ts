export interface User {
  id: number
  email: string
  name: string
  is_admin: boolean
  created_at: string
}

export interface UserProjection {
  id: number
  name: string
  email: string
}

export type ProjectRole = 'owner' | 'member' | 'viewer'
export type ProjectStatus = 'active' | 'archived'
export type StoryStatus = 'backlog' | 'in_progress' | 'in_review' | 'done'
export type StoryPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type MemberRole = Exclude<ProjectRole, 'owner'>

export interface Project {
  id: number
  name: string
  description: string | null
  owner_id: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectWithRole extends Project {
  role: ProjectRole
}

export interface PaginatedList<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

export interface ValidationIssue {
  path: string | Array<string | number>
  message: string
  code?: string
}

export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    details?: ValidationIssue[] | null
  }
}

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  name: string
}

export interface ProjectInput {
  name: string
  description?: string | null
}

export interface ProjectPatch {
  name?: string
  description?: string | null
}

export interface Member {
  id: number
  name: string
  email: string
  role: ProjectRole
}

export interface MemberInput {
  email: string
  role: MemberRole
}

export interface Story {
  id: number
  project_id: number
  title: string
  description: string | null
  acceptance_criteria: string | null
  status: StoryStatus
  priority: StoryPriority
  story_points: number | null
  assignee_id: number | null
  assignee: UserProjection | null
  position: number
  created_at: string
  updated_at: string
}

export interface StoryInput {
  title: string
  description?: string | null
  acceptance_criteria?: string | null
  status?: StoryStatus
  priority?: StoryPriority
  story_points?: number | null
  assignee_id?: number | null
}

export type StoryPatch = Partial<StoryInput>

export interface Task {
  id: number
  story_id: number
  title: string
  description: string | null
  status: TaskStatus
  assignee_id: number | null
  assignee: UserProjection | null
  estimate_hours: number | null
  due_date: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface TaskResource extends Task {
  project_id: number
}

export interface TaskInput {
  title: string
  description?: string | null
  status?: TaskStatus
  assignee_id?: number | null
  estimate_hours?: number | null
  due_date?: string | null
}

export type TaskPatch = Partial<TaskInput>

export interface StoryProgress {
  done_tasks: number
  total_tasks: number
  percent: number
}

export interface StoryTree extends Story {
  progress: StoryProgress
  tasks: Task[]
}

export interface ProjectTree {
  project: ProjectWithRole
  stories: StoryTree[]
}

export interface ProjectDetail {
  project: ProjectWithRole
}

export interface Activity {
  id: number
  project_id: number
  actor_id: number | null
  actor_name: string | null
  entity_type: string
  entity_id: number
  action: string
  meta: Record<string, unknown>
  created_at: string
}

export interface MyTask extends Task {
  story_title: string
  project_id: number
  project_name: string
}

export type NotificationType = 'task_completed' | 'story_completed'

export interface CompletionNotificationPayload {
  kind: NotificationType
  projectId: number
  projectName: string
  storyId: number
  storyTitle: string
  taskId?: number
  taskTitle?: string
  completedBy: {
    id: number
    name: string
  }
}

export interface Notification {
  id: number
  user_id: number
  type: NotificationType
  payload: CompletionNotificationPayload
  idempotency_key: string
  read_at: string | null
  created_at: string
}

export interface NotificationListQuery {
  unread?: boolean
  limit?: number
  offset?: number
}
