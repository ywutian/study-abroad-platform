export const TEST_TYPES = [
  { value: 'SAT', label: 'SAT', maxScore: 1600 },
  { value: 'ACT', label: 'ACT', maxScore: 36 },
  { value: 'TOEFL', label: 'TOEFL', maxScore: 120 },
  { value: 'IELTS', label: 'IELTS', maxScore: 9 },
  { value: 'AP', label: 'AP', maxScore: 5 },
  { value: 'IB', label: 'IB', maxScore: 45 },
  { value: 'A_LEVEL', label: 'A-Level', maxScore: 240 },
  { value: 'IGCSE', label: 'IGCSE', maxScore: 90 },
];

export const AP_SUBJECTS = [
  'Calculus AB',
  'Calculus BC',
  'Statistics',
  'Physics C: Mechanics',
  'Physics C: E&M',
  'Physics 1',
  'Physics 2',
  'Chemistry',
  'Biology',
  'Computer Science A',
  'CS Principles',
  'English Language',
  'English Literature',
  'US History',
  'World History',
  'European History',
  'Psychology',
  'Economics (Macro)',
  'Economics (Micro)',
  'Environmental Science',
  'Spanish Language',
  'Chinese Language',
];

export const IB_SUBJECTS = [
  // Group 1-2: Languages
  'English A',
  'Chinese A',
  'English B',
  'Chinese B',
  'Spanish B',
  'French B',
  // Group 3: Individuals & Societies
  'History',
  'Economics',
  'Psychology',
  'Geography',
  'Business Management',
  // Group 4: Sciences
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'ESS',
  // Group 5: Mathematics
  'Mathematics AA',
  'Mathematics AI',
  // Group 6: The Arts
  'Visual Arts',
  'Music',
  'Theatre',
];

export const A_LEVEL_SUBJECTS = [
  // STEM
  'Mathematics',
  'Further Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Design & Technology',
  'Engineering',
  // Humanities & Social Sciences
  'Economics',
  'Business Studies',
  'Accounting',
  'History',
  'Geography',
  'Psychology',
  'Sociology',
  'Politics',
  'Philosophy & Ethics',
  // Languages
  'Chinese',
  'French',
  'Spanish',
  'German',
  'Japanese',
  // Arts
  'English Literature',
  'Art & Design',
  'Music',
];

export const A_LEVEL_GRADES = ['A*', 'A', 'B', 'C', 'D', 'E', 'U'] as const;
export const A_LEVEL_UCAS: Record<string, number> = {
  'A*': 56,
  A: 48,
  B: 40,
  C: 32,
  D: 24,
  E: 16,
  U: 0,
};

export const IGCSE_SUBJECTS = [
  // Math
  'Mathematics',
  'Additional Mathematics',
  // English
  'English Language',
  'English Literature',
  // Sciences
  'Physics',
  'Chemistry',
  'Biology',
  'Combined Science',
  // Languages
  'Chinese (First Language)',
  'Chinese (Second Language)',
  'French',
  'Spanish',
  'German',
  // Humanities
  'History',
  'Geography',
  'Economics',
  'Sociology',
  // Business & Computing
  'Business Studies',
  'Computer Science',
  'Accounting',
  // Arts
  'Art & Design',
  'Music',
  'Drama',
  // Other
  'Physical Education',
  'Environmental Management',
];

export const IGCSE_GRADES = ['9', '8', '7', '6', '5', '4', '3', '2', '1'] as const;
export const IGCSE_LETTER_GRADES = ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U'] as const;
export const IGCSE_GRADE_POINTS: Record<string, number> = {
  '9': 9,
  'A*': 9,
  '8': 8,
  A: 8,
  '7': 7,
  B: 7,
  '6': 6,
  C: 6,
  '5': 5,
  D: 5,
  '4': 4,
  E: 4,
  '3': 3,
  F: 3,
  '2': 2,
  G: 2,
  '1': 1,
  U: 0,
};
