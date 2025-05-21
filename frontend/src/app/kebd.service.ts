// kebd.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
}