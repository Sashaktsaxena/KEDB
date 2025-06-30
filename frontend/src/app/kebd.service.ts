// kebd.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';

// Environment configuration - normally would be in environment.ts
const API_URL = 'http://localhost:3000/api';
export interface User{
  id:number ;
  employeeId: string;
  fullName :string ;
  department: string;
}
// KEBD record interface
export interface KebdRecord {
  id?: number;
  errorId: string;
  title: string;
  description: string;
  rootCause: string;
  impact: string;
  category: string;
  subcategory: string;
  workaround: string;
  resolution?: string;
  status: string;
  dateIdentified: string;
  lastUpdated?: string;
  linkedIncidents?: string;
  owner: string;
  ownerId?: number;
  originalOwner?: string;
  currentAssignee?: string;
  currentAssigneeId?: number;
  isOwner?: boolean;
  isAssignee?: boolean;
  priority: string;
  environment: string;
  attachments?: string;
  dueDate?: string;
  daysRemaining?: number;
}

export interface Attachment {
  id: number;
  record_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  comment?: string; // Make it optional since older attachments might not have it
  created_at: string;
}

export interface AssignmentHistory {
  id: number;
  recordId: number;
  previousAssignee?: string;
  newAssignee: string;
  changedBy: string;
  changeDate: string;
  notes?: string;
  durationDays?: number;
}

export interface AssignmentHistoryResponse {
  owner: {
    id: number;
    name: string;
  } | null;
  currentAssignee: {
    id: number;
    name: string;
    assignmentDate: string;
    dueDate: string | null;
  } | null;
  history: AssignmentHistory[];
}

@Injectable({
  providedIn: 'root'
})
export class KebdService {
  constructor(
    public http: HttpClient,  // Changed from private to public
    private authService: AuthService
  ) {}

  createKebdRecord(record: KebdRecord): Observable<any> {
    return this.http.post(`${API_URL}/kebd`, record);
  }

  getKebdRecords(): Observable<KebdRecord[]> {
    return this.http.get<KebdRecord[]>(`${API_URL}/kebd`);
  }
saveDraft(formData: any): Observable<any> {
  return this.http.post(`${API_URL}/drafts`, formData);
}

// Get all drafts for the current user
getDrafts(): Observable<any[]> {
  return this.http.get<any[]>(`${API_URL}/drafts`);
}

// Get a specific draft
getDraft(id: number): Observable<any> {
  return this.http.get<any>(`${API_URL}/drafts/${id}`);
}

// Delete a draft
deleteDraft(id: number): Observable<any> {
  return this.http.delete(`${API_URL}/drafts/${id}`);
}

// Submit a draft as a complete record
submitDraft(id: number, formData: any): Observable<any> {
  return this.http.post(`${API_URL}/drafts/${id}/submit`, formData);
}
  getKebdRecord(id: number): Observable<KebdRecord> {
    return this.http.get<KebdRecord>(`${API_URL}/kebd/${id}`);
  }

  updateKebdRecord(id: number, record: KebdRecord): Observable<any> {
    return this.http.put(`${API_URL}/kebd/${id}`, record);
  }

  deleteKebdRecord(id: number): Observable<any> {
    return this.http.delete(`${API_URL}/kebd/${id}`);
  }
  
  // Check if user can delete records (admin only)
  canDeleteRecords(): boolean {
    return this.authService.isAdmin();
  }

  uploadAttachment(recordId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post(`${API_URL}/kebd/${recordId}/attachments`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }
  

  uploadAttachmentWithComment(recordId: number, file: File, comment: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('comment', comment || ''); // Send empty string if no comment
    console.log(`Uploading file ${file.name} with comment: "${comment}"`);
    return this.http.post(`${API_URL}/kebd/${recordId}/attachments`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  getAttachments(recordId: number): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`${API_URL}/kebd/${recordId}/attachments`);
  }

  getAttachmentUrl(attachmentId: number): string {
    return `${API_URL}/attachments/${attachmentId}`;
  }

  deleteAttachment(attachmentId: number): Observable<any> {
    return this.http.delete(`${API_URL}/attachments/${attachmentId}`);
  }
  
  // Get archived records (status = 'Archived')
  getArchivedRecords(): Observable<KebdRecord[]> {
    return this.http.get<any[]>(`${API_URL}/kebd/archived`).pipe(
      map(records => {
        // Convert snake_case property names to camelCase
        return records.map(record => ({
          id: record.id,
          errorId: record.error_id, // <-- This is the key fix
          title: record.title,
          description: record.description,
          rootCause: record.rootCause,
          impact: record.impact,
          category: record.category,
          subcategory: record.subcategory,
          workaround: record.workaround,
          resolution: record.resolution,
          status: record.status,
          dateIdentified: record.dateIdentified,
          lastUpdated: record.lastUpdated,
          linkedIncidents: record.linkedIncidents,
          owner: record.owner,
          priority: record.priority,
          environment: record.environment,
          attachments: record.attachments
        }));
      })
    );
  }

  // Update a record's status
  updateRecordStatus(id: number, status: string): Observable<any> {
    return this.http.patch(`${API_URL}/kebd/${id}/status`, { status });
  }

  // Update a record's owner
  updateRecordOwner(id: number, owner: string): Observable<any> {
    return this.http.patch(`${API_URL}/kebd/${id}/owner`, { owner });
  }
  getUsers():Observable<User[]>{
    return this.http.get<any[]>(`${API_URL}/users`).pipe(
      map(users => users.map(user => ({
        id: user.id,
        employeeId: user.employee_id,
        fullName: user.full_name,
        department: user.department
      })))
    );
  }

  // Get assignment history for a record
  getAssignmentHistory(recordId: number): Observable<AssignmentHistoryResponse> {
    return this.http.get<AssignmentHistoryResponse>(`${API_URL}/kebd/${recordId}/history`);
  }
// Add this method to kebd.service.ts
revertAssignment(recordId: number, notes?: string): Observable<any> {
  console.log('Reverting assignment in service:', {
    recordId,
    notes
  });
  return this.http.post(`${API_URL}/kebd/${recordId}/revert`, {
    notes
  });
}
  // Assign a record to a user
  assignRecord(recordId: number, assignedTo: string, dueDate?: string, notes?: string): Observable<any> {
      console.log('Assigning record in service:', {
    recordId,
    assignedTo,
    dueDate,
    notes
  });
    return this.http.post(`${API_URL}/kebd/${recordId}/assign`, {
      assignedTo,
      dueDate,
      notes
    });
  }
}