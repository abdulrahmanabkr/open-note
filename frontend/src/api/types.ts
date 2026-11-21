export type Role = 'student' | 'admin' | 'superadmin';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  schoolId: number | null;
  schoolName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  level: string | null;
  matricNo: string | null;
  bio: string | null;
  createdAt: string;
}

export interface NotePublisher {
  id: number;
  fullName: string;
  level: string | null;
  departmentName: string | null;
  role: Role;
}

export interface NoteImage {
  id: number;
  path: string;
  sortOrder: number;
}

export interface Note {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  courseCode: string | null;
  courseId: number | null;
  schoolId: number | null;
  schoolName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  level: string;
  academicSession: string | null;
  noteType: string;
  noteTypeLabel: string;
  status: 'published' | 'hidden';
  viewCount: number;
  downloadCount: number;
  imageCount: number;
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
  publisher: NotePublisher;
  images?: NoteImage[];
  isBookmarked?: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  category: 'school' | 'educational' | 'business';
  categoryLabel: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: number; fullName: string | null; role: string | null } | null;
}

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface School {
  id: number;
  name: string;
  slug: string;
  departments: Department[];
}

export interface Course {
  id: number;
  code: string;
  title: string;
  level: string;
  departmentId: number;
}

export interface Option {
  value: string;
  label: string;
}

export interface Taxonomy {
  schools: School[];
  levels: readonly string[];
  noteTypes: Option[];
  announcementCategories: Option[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface PublicStats {
  notes: number;
  students: number;
  departments: number;
  downloads: number;
}

export interface AdminStats {
  stats: {
    students: number;
    admins: number;
    notes: number;
    announcements: number;
    downloads: number;
    views: number;
  };
  latestNotes: Array<{
    id: number;
    title: string;
    createdAt: string;
    publisherName: string;
  }>;
}

export interface NoteFilters {
  q?: string;
  schoolId?: string;
  departmentId?: string;
  level?: string;
  noteType?: string;
  sort?: string;
  page?: string;
}
