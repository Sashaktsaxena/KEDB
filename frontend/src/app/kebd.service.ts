// kebd.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

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
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class KebdService {
  constructor(private http: HttpClient) { }

  // Error handling method
  private handleError(error: HttpErrorResponse) {
    let errorMessage = '';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Create a new KEBD record
  createKebdRecord(record: KebdRecord): Observable<any> {
    return this.http.post(`${API_URL}/kebd`, record)
      .pipe(
        retry(1),
        catchError(this.handleError)
      );
  }

  // Get all KEBD records
  getKebdRecords(): Observable<KebdRecord[]> {
    return this.http.get<KebdRecord[]>(`${API_URL}/kebd`)
      .pipe(
        retry(1),
        catchError(this.handleError)
      );
  }

  // Get a single KEBD record by ID
  getKebdRecord(id: string): Observable<KebdRecord> {
    return this.http.get<KebdRecord>(`${API_URL}/kebd/${id}`)
      .pipe(
        retry(1),
        catchError(this.handleError)
      );
  }

  // Update a KEBD record
  updateKebdRecord(id: string, record: KebdRecord): Observable<any> {
    return this.http.put(`${API_URL}/kebd/${id}`, record)
      .pipe(
        retry(1),
        catchError(this.handleError)
      );
  }

  // Delete a KEBD record
  deleteKebdRecord(id: string): Observable<any> {
    return this.http.delete(`${API_URL}/kebd/${id}`)
      .pipe(
        retry(1),
        catchError(this.handleError)
      );
  }
}