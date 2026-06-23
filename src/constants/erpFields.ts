export interface ERPField {
  key: string;
  label: string;
  required?: boolean;
  autoMapKeywords: string[];
}

export const ERP_FIELDS: ERPField[] = [
  { key: 'name', label: 'Student Name', required: true, autoMapKeywords: ['name', 'student', 'fullname'] },
  { key: 'fatherName', label: 'Father\'s Name', required: true, autoMapKeywords: ['father', 'parent'] },
  { key: 'motherName', label: 'Mother\'s Name', required: false, autoMapKeywords: ['mother'] },
  { key: 'dob', label: 'Date of Birth', required: true, autoMapKeywords: ['dob', 'birth', 'date'] },
  { key: 'regNo', label: 'Registration No', required: true, autoMapKeywords: ['reg', 'enrollment', 'roll', 'registration_id'] },
  { key: 'course', label: 'Course', required: false, autoMapKeywords: ['course', 'degree'] },
  { key: 'stream', label: 'Stream', required: false, autoMapKeywords: ['stream', 'branch'] },
  { key: 'batch', label: 'Batch/Semester', required: false, autoMapKeywords: ['batch', 'year', 'semester'] },
  { key: 'section', label: 'Section', required: false, autoMapKeywords: ['section'] },
  { key: 'oldNew', label: 'oldNew (AIOC/BC)', required: true, autoMapKeywords: ['old', 'new', 'allocation', 'category', 'reservation'] },
  { key: 'category', label: 'Category', required: true, autoMapKeywords: ['scheme', 'aided', 'sfs'] },
  { key: 'gender', label: 'Gender', required: true, autoMapKeywords: ['gender', 'sex'] },
  { key: 'phone', label: 'Phone Number', required: true, autoMapKeywords: ['phone', 'mobile', 'contact'] },
  { key: 'doa', label: 'Date of Admission', required: false, autoMapKeywords: ['doa', 'admission'] },
];

export const INITIAL_PAYLOAD_DEFAULTS = {
  section: "A",
  branchId: "Morning",
  session: "2025-26 Odd",
  entity: "6487ec9e91f7297664a62ffc",
  qualifications: [],
  role: [],
  workExperience: [],
  oldNew: "HOGC",
  bankDetails: {}
};
