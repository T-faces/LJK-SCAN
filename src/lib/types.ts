export type Role = 'admin' | 'guru'
export type ExamType = 'UH' | 'UTS' | 'UAS' | 'Lainnya'

export interface Profile { id: string; full_name: string; role: Role; is_active: boolean }
export interface SchoolSettings {
  id: number; school_name: string; address: string | null; logo_path: string | null
  academic_year: string; semester: string; headmaster: string | null; passing_grade: number
}
export interface Teacher {
  id: string; nip: string | null; full_name: string; email: string | null; phone: string | null
  user_id: string | null; is_active: boolean
}
export interface ClassRoom { id: string; name: string; grade_level: string | null }
export interface Student {
  id: string; nis: string; full_name: string; class_id: string | null; gender: 'L' | 'P' | null; is_active: boolean
  class?: { name: string } | null
}
export interface Subject { id: string; code: string; name: string; is_active: boolean }
export interface Exam {
  id: string; title: string; exam_type: ExamType; subject_id: string; class_id: string; teacher_id: string | null
  exam_date: string; question_count: number; option_count: 4 | 5; pakets: string[]
  subject?: { code: string; name: string } | null
  class?: { name: string } | null
  teacher?: { full_name: string } | null
}
export interface Sheet {
  id: string; exam_id: string; student_id: string; paket: string; status: 'belum' | 'discan'
  answers: string | null; correct_count: number | null; wrong_count: number | null; blank_count: number | null
  score: number | null; scanned_at: string | null
  student?: { nis: string; full_name: string; class?: { name: string } | null } | null
  exam?: Exam | null
}
export interface ScoreStats {
  avg_score: number | null; max_score: number | null; min_score: number | null; n: number
  b_a: number; b_b: number; b_c: number; b_d: number
}
