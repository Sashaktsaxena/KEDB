// kebd.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';

// Environment configuration - normally would be in environment.ts
const API_URL = 'http://localhost:3000/api';

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
  priority: string;
  environment: string;
  attachments?: string;
}

export interface Attachment {
  id: number;
  record_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class KebdService {
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  createKebdRecord(record: KebdRecord): Observable<any> {
    return this.http.post(`${API_URL}/kebd`, record);
  }

  getKebdRecords(): Observable<KebdRecord[]> {
    return this.http.get<KebdRecord[]>(`${API_URL}/kebd`);
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
          rootCause: record.root_cause,
          impact: record.impact,
          category: record.category,
          subcategory: record.subcategory,
          workaround: record.workaround,
          resolution: record.resolution,
          status: record.status,
          dateIdentified: record.date_identified,
          lastUpdated: record.last_updated,
          linkedIncidents: record.linked_incidents,
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
}