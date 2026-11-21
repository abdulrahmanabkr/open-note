export const NOTE_TYPES = [
  { value: 'lecture_note', label: 'Lecture note' },
  { value: 'handout', label: 'Handout' },
  { value: 'past_question', label: 'Past question' },
  { value: 'summary', label: 'Summary' },
  { value: 'textbook', label: 'Textbook extract' },
  { value: 'other', label: 'Other' },
] as const;

export type NoteType = (typeof NOTE_TYPES)[number]['value'];

export const NOTE_TYPE_VALUES = NOTE_TYPES.map((type) => type.value);

export const LEVELS = ['100', '200', '300', '400', '500', '600', '700'] as const;

export const ANNOUNCEMENT_CATEGORIES = [
  { value: 'school', label: 'School update' },
  { value: 'educational', label: 'Educational' },
  { value: 'business', label: 'Business' },
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]['value'];

export const ANNOUNCEMENT_CATEGORY_VALUES = ANNOUNCEMENT_CATEGORIES.map((category) => category.value);
