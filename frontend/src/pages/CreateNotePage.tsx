import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, assetUrl } from '../api/client';
import type { Course, Note, NoteImage, Taxonomy } from '../api/types';
import { Avatar } from '../components/Avatar';
import { ErrorNotice } from '../components/ErrorNotice';
import { BookIcon, CheckIcon, CloseIcon, NoteIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, levelLabel } from '../lib/format';

interface DraftImage {
  file: File;
  url: string;
  previewable: boolean;
}

const currentSession = () => {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${year + 1}`;
};

const MAX_IMAGES = 5000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES =
  'image/jpeg,image/png,image/webp,image/gif,image/avif,image/tiff,image/bmp,application/pdf';
const PREVIEWABLE = /^image\/(jpeg|png|webp|gif|avif)$/;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
};

function mimeOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? '';
}

function fileTypeLabel(file: File): string {
  return file.name.split('.').pop()?.toUpperCase() || 'FILE';
}

export function CreateNotePage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [existingImages, setExistingImages] = useState<NoteImage[]>([]);
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const draftRef = useRef<DraftImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    subject: '',
    description: '',
    schoolId: '',
    departmentId: '',
    level: '',
    courseId: '',
    courseCode: '',
    academicSession: currentSession(),
    noteType: 'lecture_note',
  });

  draftRef.current = draftImages;
  useEffect(
    () => () => {
      draftRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    },
    [],
  );

  useEffect(() => {
    api.get<Taxonomy>('/taxonomy').then(setTaxonomy).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<{ note: Note }>(`/notes/${id}`)
      .then(({ note }) => {
        if (cancelled) return;
        if (user && note.publisher.id !== user.id && user.role === 'student') {
          setLoadError('You can only edit notes that you published.');
          return;
        }
        setForm({
          title: note.title,
          subject: note.subject,
          description: note.description ?? '',
          schoolId: note.schoolId ? String(note.schoolId) : '',
          departmentId: note.departmentId ? String(note.departmentId) : '',
          level: note.level,
          courseId: note.courseId ? String(note.courseId) : '',
          courseCode: note.courseCode ?? '',
          academicSession: note.academicSession ?? currentSession(),
          noteType: note.noteType,
        });
        setExistingImages(note.images ?? []);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, user]);

  useEffect(() => {
    if (!form.departmentId || !form.level) {
      setCourses([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ courses: Course[] }>('/taxonomy/courses', {
        departmentId: form.departmentId,
        level: form.level,
      })
      .then((data) => {
        if (!cancelled) setCourses(data.courses);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [form.departmentId, form.level]);

  const school = taxonomy?.schools.find((item) => String(item.id) === form.schoolId);
  const departments = school ? school.departments : (taxonomy?.schools ?? []).flatMap((item) => item.departments);
  const department = departments.find((item) => String(item.id) === form.departmentId);
  const totalImages = existingImages.length + draftImages.length;

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const accepted: DraftImage[] = [];
      const rejected: string[] = [];

      for (const file of incoming) {
        const mime = mimeOf(file);
        if (!/^(image\/(jpeg|png|webp|gif|avif|tiff|tif|x-tiff|bmp|x-ms-bmp|x-bmp)|application\/pdf)$/.test(mime)) {
          rejected.push(`${file.name} is not a supported file type.`);
          continue;
        }
        const isDocument = mime === 'application/pdf' || mime.includes('tiff') || mime.includes('bmp');
        const limit = isDocument ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
        if (file.size > limit) {
          rejected.push(`${file.name} is larger than ${isDocument ? '50 MB' : '8 MB'}.`);
          continue;
        }
        accepted.push({ file, url: URL.createObjectURL(file), previewable: PREVIEWABLE.test(mime) });
      }

      setDraftImages((current) => {
        const room = MAX_IMAGES - existingImages.length - current.length;
        if (accepted.length > room) {
          rejected.push(`You can add ${Math.max(room, 0)} more page${room === 1 ? '' : 's'}.`);
        }
        return [...current, ...accepted.slice(0, Math.max(room, 0))];
      });

      if (rejected.length > 0) setError(rejected[0]);
    },
    [existingImages.length],
  );

  const removeDraft = (index: number) => {
    setDraftImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, position) => position !== index);
    });
  };

  const removeExisting = async (imageId: number) => {
    if (!id) return;
    if (!window.confirm('Remove this page? This cannot be undone.')) return;
    try {
      await api.delete(`/notes/${id}/images/${imageId}`);
      setExistingImages((current) => current.filter((image) => image.id !== imageId));
      notify('Page removed.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove that page.', 'error');
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.title.trim().length < 3) nextErrors.title = 'Give the note a title.';
    if (form.subject.trim().length < 2) nextErrors.subject = 'Enter the subject or topic.';
    if (!form.departmentId) nextErrors.departmentId = 'Select a department.';
    if (!form.level) nextErrors.level = 'Select a level.';
    if (totalImages === 0) nextErrors.images = 'Add at least one image of the note.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setError('Please complete the highlighted fields.');
      return;
    }

    const data = new FormData();
    data.append('title', form.title.trim());
    data.append('subject', form.subject.trim());
    if (form.description.trim()) data.append('description', form.description.trim());
    data.append('departmentId', form.departmentId);
    data.append('level', form.level);
    if (form.courseId) data.append('courseId', form.courseId);
    if (form.courseCode.trim()) data.append('courseCode', form.courseCode.trim());
    if (form.academicSession.trim()) data.append('academicSession', form.academicSession.trim());
    data.append('noteType', form.noteType);
    draftImages.forEach((image) => data.append('images', image.file));

    setSubmitting(true);
    setError(null);
    setErrors({});

    try {
      const result = isEdit && id
        ? await api.patch<{ note: Note }>(`/notes/${id}`, data)
        : await api.post<{ note: Note }>('/notes', data);
      notify(isEdit ? 'Note updated.' : 'Your note is live. Thanks for sharing!');
      setDraftImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.url));
        return [];
      });
      navigate(`/notes/${result.note.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) {
          setErrors(err.details);
          if (err.details.images) setError(err.details.images);
        }
      } else {
        setError('Could not publish the note. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const publisherLine = useMemo(() => {
    const level = user?.level ? levelLabel(user.level) : '';
    return [level, user?.departmentName].filter(Boolean).join(' · ');
  }, [user]);

  if (loadError) {
    return (
      <section className="container page-section">
        <ErrorNotice message={loadError} />
        <Link to="/dashboard" className="btn btn--ghost">
          Back to dashboard
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="container page-section">
        <div className="page-loader" role="status">
          <span className="spinner" />
          <span>Loading your note…</span>
        </div>
      </section>
    );
  }

  return (
    <section className="container page-section">
      <div className="page-head">
        <div>
          <span className="eyebrow">{isEdit ? 'Update note' : 'Share a note'}</span>
          <h1>{isEdit ? 'Edit your note' : 'Post a note'}</h1>
          <p>
            {isEdit
              ? 'Fix a typo, change the course details or add the remaining pages.'
              : 'Photograph your notes or upload screenshots, tag the course, and publish. Every post shows your name, class and the time it went live.'}
          </p>
        </div>
      </div>

      {error ? <ErrorNotice message={error} /> : null}

      <form className="post-layout" onSubmit={handleSubmit} noValidate>
        <div className="post-main">
          <section className="panel">
            <div className="panel__head">
              <span className="step">1</span>
              <div>
                <h2>Note details</h2>
                <p>What should a student see before opening the note?</p>
              </div>
            </div>

            <div className="form">
              <label className={`field ${errors.title ? 'field--error' : ''}`}>
                <span className="field__label">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => set('title', event.target.value)}
                  placeholder="e.g. Data Structures — Complete Lecture Notes"
                  maxLength={200}
                />
                {errors.title ? <span className="field__error">{errors.title}</span> : null}
              </label>

              <label className={`field ${errors.subject ? 'field--error' : ''}`}>
                <span className="field__label">Subject / topic</span>
                <input
                  value={form.subject}
                  onChange={(event) => set('subject', event.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  maxLength={150}
                />
                {errors.subject ? <span className="field__error">{errors.subject}</span> : null}
              </label>

              <label className="field">
                <span className="field__label">Description (optional)</span>
                <textarea
                  value={form.description}
                  onChange={(event) => set('description', event.target.value)}
                  placeholder="What is covered? Anything a reader should know before opening?"
                  rows={4}
                  maxLength={5000}
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <span className="step">2</span>
              <div>
                <h2>Where it belongs</h2>
                <p>These tags power the search and filter results.</p>
              </div>
            </div>

            <div className="form form-grid">
              <label className={`field ${errors.departmentId ? 'field--error' : ''}`}>
                <span className="field__label">School / faculty</span>
                <select
                  value={form.schoolId}
                  onChange={(event) => {
                    set('schoolId', event.target.value);
                    set('departmentId', '');
                    set('courseId', '');
                  }}
                >
                  <option value="">Select a school</option>
                  {taxonomy?.schools.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`field ${errors.departmentId ? 'field--error' : ''}`}>
                <span className="field__label">Department</span>
                <select
                  value={form.departmentId}
                  onChange={(event) => {
                    set('departmentId', event.target.value);
                    set('courseId', '');
                  }}
                >
                  <option value="">Select a department</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {errors.departmentId ? <span className="field__error">{errors.departmentId}</span> : null}
              </label>

              <label className={`field ${errors.level ? 'field--error' : ''}`}>
                <span className="field__label">Level</span>
                <select
                  value={form.level}
                  onChange={(event) => {
                    set('level', event.target.value);
                    set('courseId', '');
                  }}
                >
                  <option value="">Select a level</option>
                  {taxonomy?.levels.map((level) => (
                    <option key={level} value={level}>
                      {levelLabel(level)}
                    </option>
                  ))}
                </select>
                {errors.level ? <span className="field__error">{errors.level}</span> : null}
              </label>

              <label className="field">
                <span className="field__label">Course (optional)</span>
                <select
                  value={form.courseId}
                  onChange={(event) => {
                    const selected = courses.find((course) => String(course.id) === event.target.value);
                    set('courseId', event.target.value);
                    if (selected) set('courseCode', selected.code);
                  }}
                  disabled={!form.departmentId || !form.level}
                >
                  <option value="">
                    {!form.departmentId || !form.level ? 'Select department and level first' : 'No specific course'}
                  </option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} — {course.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Course code</span>
                <input
                  value={form.courseCode}
                  onChange={(event) => set('courseCode', event.target.value)}
                  placeholder="CSC 301"
                  maxLength={30}
                />
              </label>

              <label className="field">
                <span className="field__label">Academic session</span>
                <input
                  value={form.academicSession}
                  onChange={(event) => set('academicSession', event.target.value)}
                  placeholder="2025/2026"
                  maxLength={20}
                />
              </label>

              <label className="field">
                <span className="field__label">Note type</span>
                <select value={form.noteType} onChange={(event) => set('noteType', event.target.value)}>
                  {taxonomy?.noteTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <span className="step">3</span>
              <div>
                <h2>The pages</h2>
                <p>Upload clear images or PDF files.</p>
              </div>
            </div>

            {errors.images ? <div className="field__error field__error--block">{errors.images}</div> : null}

            {existingImages.length > 0 ? (
              <>
                <h3 className="small-heading">Current pages</h3>
                <div className="thumb-grid">
                  {existingImages.map((image, index) => (
                    <div className="thumb" key={image.id}>
                      <img src={assetUrl(image.path)} alt={`Existing page ${index + 1}`} />
                      <span className="thumb__index">{index + 1}</span>
                      <button
                        type="button"
                        className="thumb__remove"
                        onClick={() => void removeExisting(image.id)}
                        aria-label={`Remove page ${index + 1}`}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <label
              className={`dropzone ${dragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input type="file" accept={ACCEPTED_TYPES} multiple onChange={handleFileInput} hidden />
              <span className="dropzone__icon">
                <UploadIcon size={26} />
              </span>
              <strong>Drop note pages here, or click to choose</strong>
              <span>
                {totalImages} {totalImages === 1 ? 'page' : 'pages'} added
              </span>
            </label>

            {draftImages.length > 0 ? (
              <div className="thumb-grid">
                {draftImages.map((image, index) => (
                  <div className="thumb" key={image.url}>
                    {image.previewable ? (
                      <img src={image.url} alt={`New page ${index + 1}`} />
                    ) : (
                      <span className="thumb__file">
                        <NoteIcon size={22} />
                        <span>{fileTypeLabel(image.file)}</span>
                      </span>
                    )}
                    <span className="thumb__index">{existingImages.length + index + 1}</span>
                    <button
                      type="button"
                      className="thumb__remove"
                      onClick={() => removeDraft(index)}
                      aria-label={`Remove new page ${index + 1}`}
                    >
                      <CloseIcon size={15} />
                    </button>
                  </div>
                ))}
                {totalImages < MAX_IMAGES ? (
                  <label className="thumb thumb--add">
                    <input type="file" accept={ACCEPTED_TYPES} multiple onChange={handleFileInput} hidden />
                    <PlusIcon size={22} />
                    <span>Add more</span>
                  </label>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="post-actions">
            <Link to={isEdit && id ? `/notes/${id}` : '/dashboard'} className="btn btn--ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Publishing…' : isEdit ? 'Save changes' : 'Publish note'}
            </button>
          </div>
        </div>

        <aside className="post-aside">
          <div className="publisher-preview">
            <span className="eyebrow">Publisher</span>
            <div className="publisher-preview__identity">
              <Avatar name={user?.fullName} size="lg" />
              <div>
                <strong>{user?.fullName}</strong>
                <span>{publisherLine || 'Add your class details in your profile'}</span>
              </div>
            </div>
            <div className="publisher-preview__meta">
              <div>
                <span>Department</span>
                <strong>{department?.name ?? user?.departmentName ?? 'Not selected'}</strong>
              </div>
              <div>
                <span>Published</span>
                <strong>{formatDate(new Date())}</strong>
              </div>
            </div>
            <p className="publisher-preview__note">
              This card appears on the note. Keep your profile up to date so classmates know who shared it.
            </p>
            {!user?.departmentName || !user?.level ? (
              <Link to="/profile" className="text-link">
                Complete your profile →
              </Link>
            ) : null}
          </div>

          <div className="checklist">
            <h3>
              <BookIcon size={17} /> Before you publish
            </h3>
            <ul>
              <li>
                <CheckIcon size={15} /> Pages are readable and in order
              </li>
              <li>
                <CheckIcon size={15} /> Course code and level are correct
              </li>
              <li>
                <CheckIcon size={15} /> You have permission to share this material
              </li>
              <li>
                <CheckIcon size={15} /> The lecturer or source is credited
              </li>
            </ul>
          </div>

          <div className="aside-cta">
            <span className="aside-cta__icon">
              <NoteIcon size={20} />
            </span>
            <h4>Notes stay yours</h4>
            <p>You can edit the details or remove a page at any time from your dashboard.</p>
          </div>
        </aside>
      </form>
    </section>
  );
}
