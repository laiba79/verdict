import api from './api';
import type {
  Employee, EmployeeBase, PredictResponse, PredictionHistory, FormOptions, User, UserRole, AuditLogEntry,
  JobDescription, Candidate, MatchReport, RankingResult, BiasCheckResult, ResumeDoctorResult, PipelineSnapshot,
  BenchmarkReport, FairnessReport,
} from '../types';

// ---- meta ----
export const getFormOptions = () => api.get<FormOptions>('/meta/form-options').then(r => r.data);
export const getModelsStatus = () =>
  api.get<{ ready: boolean; available_targets: string[]; explainers_loaded: string[] }>('/meta/models-status').then(r => r.data);
export const getModelBenchmark = () => api.get<BenchmarkReport>('/meta/benchmark').then(r => r.data);
export const getFairnessAudit = () => api.get<FairnessReport>('/meta/fairness').then(r => r.data);

// ---- employees ----
export const listEmployees = (skip = 0, limit = 50) =>
  api.get<Employee[]>('/employees', { params: { skip, limit } }).then(r => r.data);
export const getEmployee = (id: number) => api.get<Employee>(`/employees/${id}`).then(r => r.data);
export const createEmployee = (payload: EmployeeBase) =>
  api.post<Employee>('/employees', payload).then(r => r.data);
export const updateEmployee = (id: number, payload: EmployeeBase) =>
  api.put<Employee>(`/employees/${id}`, payload).then(r => r.data);
export const deleteEmployee = (id: number) => api.delete(`/employees/${id}`);

// ---- predictions ----
export const predictQuick = (payload: EmployeeBase & { save_employee: boolean }) =>
  api.post<PredictResponse>('/predictions/quick', payload).then(r => r.data);
export const predictForEmployee = (employeeId: number) =>
  api.post<PredictResponse>(`/predictions/employee/${employeeId}`).then(r => r.data);
export const getPredictionHistory = (employeeId: number) =>
  api.get<PredictionHistory[]>(`/predictions/history/${employeeId}`).then(r => r.data);
export const listPendingPredictions = () =>
  api.get<PredictionHistory[]>('/predictions/pending').then(r => r.data);
export const getAuditLog = () =>
  api.get<AuditLogEntry[]>('/predictions/audit').then(r => r.data);
export const approvePrediction = (id: number, note?: string) =>
  api.post<PredictionHistory>(`/predictions/${id}/approve`, { note: note ?? null }).then(r => r.data);
export const rejectPrediction = (id: number, note?: string) =>
  api.post<PredictionHistory>(`/predictions/${id}/reject`, { note: note ?? null }).then(r => r.data);

// ---- users (admin only) ----
export const listUsers = () => api.get<User[]>('/auth/users').then(r => r.data);
// Active managers only, available to Admin + HR -- used to populate the
// "assign manager" picker on the employee form.
export const listManagers = () => api.get<User[]>('/auth/managers').then(r => r.data);
export const createUser = (payload: { email: string; full_name?: string; password: string; role: UserRole }) =>
  api.post<User>('/auth/register', payload).then(r => r.data);
export const setUserStatus = (id: number, is_active: boolean) =>
  api.patch<User>(`/auth/users/${id}/status`, { is_active }).then(r => r.data);

// ---- chatbot ----
export const askChatbot = (message: string, history: { role: 'user' | 'assistant'; content: string }[]) =>
  api.post<{ reply: string }>('/chatbot/ask', { message, history }).then(r => r.data);

// ---- recruitment (AI resume matcher) ----
export const listJobDescriptions = () =>
  api.get<JobDescription[]>('/recruitment/job-descriptions').then(r => r.data);
export const createJobDescription = (payload: { title: string; department?: string; raw_text: string }) =>
  api.post<JobDescription>('/recruitment/job-descriptions', payload).then(r => r.data);
export const deleteJobDescription = (id: number) => api.delete(`/recruitment/job-descriptions/${id}`);

export const uploadCandidate = (jobDescriptionId: number, file: File, fullName?: string) => {
  const form = new FormData();
  form.append('job_description_id', String(jobDescriptionId));
  if (fullName) form.append('full_name', fullName);
  form.append('file', file);
  return api.post<Candidate>('/recruitment/candidates', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const analyzeCandidate = (candidateId: number) =>
  api.post<MatchReport>(`/recruitment/candidates/${candidateId}/analyze`).then(r => r.data);
export const generateInterviewQuestions = (candidateId: number) =>
  api.post<MatchReport>(`/recruitment/candidates/${candidateId}/interview-questions`).then(r => r.data);
export const getCandidateReports = (candidateId: number) =>
  api.get<MatchReport[]>(`/recruitment/candidates/${candidateId}/reports`).then(r => r.data);
export const getRanking = (jobDescriptionId: number) =>
  api.get<RankingResult>(`/recruitment/job-descriptions/${jobDescriptionId}/ranking`).then(r => r.data);

export const checkBias = (raw_text: string) =>
  api.post<BiasCheckResult>('/recruitment/bias-check', { raw_text }).then(r => r.data);

export const resumeDoctor = (jdText: string, file: File) => {
  const form = new FormData();
  form.append('jd_text', jdText);
  form.append('file', file);
  return api.post<ResumeDoctorResult>('/recruitment/resume-doctor', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const getPipelineSnapshot = () =>
  api.get<PipelineSnapshot>('/recruitment/pipeline-snapshot').then(r => r.data);