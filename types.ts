
export enum UserRole {
  AGENTE = 'AGENTE',
  GESTOR = 'GESTOR'
}

export interface UserProfile {
  uid: string;
  name: string;
  matricula: string;
  sector: string;
  role: UserRole;
  termsAccepted: boolean;
  termsAcceptedAt?: number;
}

export interface AITSession {
  id: string;
  start: number;
  end?: number;
  durationMs: number;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: number;
  endTime?: number;
  status: 'ACTIVE' | 'CLOSED';
  declaredAitCount?: number;
  observations?: string;
  sessions: AITSession[];
  metrics: {
    totalTimeMs: number;
    sessionCount: number;
    avgSessionTimeMs: number;
    firstAccess?: number;
    lastAccess?: number;
  };
  flags: string[];
}

export enum AlertStatus {
  OK = 'OK',
  ATENCAO = 'ATENÇÃO',
  INCONSISTENTE = 'INCONSISTENTE'
}
