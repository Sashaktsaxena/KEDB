import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Add this import
import { KebdService, KebdRecord } from '../kebd.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule], // Add FormsModule here
  templateUrl: './records.component.html',
  styleUrls: ['./records.component.css']
})
export class RecordsComponent implements OnInit {
  records: KebdRecord[] = [];
  loading: boolean = true;
  error: string = '';
  selectedRecord: KebdRecord | null = null;
  showDetailView: boolean = false;
  searchTerm: string = '';
  sortField: string = 'dateIdentified';
  sortDirection: 'asc' | 'desc' = 'desc';

  constructor(private kebdService: KebdService) {}

  ngOnInit(): void {
    this.loadRecords();
  }

  loadRecords(): void {
    this.loading = true;
    this.kebdService.getKebdRecords().subscribe({
      next: (data) => {
        this.records = data;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load records. Please try again later.';
        this.loading = false;
        console.error('Error loading records:', error);
      }
    });
  }

  viewRecordDetails(record: KebdRecord): void {
    this.selectedRecord = record;
    this.showDetailView = true;
  }

  closeDetailView(): void {
    this.showDetailView = false;
    this.selectedRecord = null;
  }

  exportToExcel(record: KebdRecord): void {
    // Create a worksheet with the record data
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet([this.formatRecordForExport(record)]);
    
    // Format column widths
    const columnWidths = [
      { wch: 15 }, // ID
      { wch: 30 }, // Title
      { wch: 50 }, // Description
      { wch: 50 }, // Root Cause
      { wch: 40 }, // Impact
      { wch: 20 }, // Category
      { wch: 20 }, // Subcategory
      { wch: 50 }, // Workaround
      { wch: 50 }, // Resolution
      { wch: 15 }, // Status
      { wch: 15 }, // Date Identified
      { wch: 30 }, // Linked Incidents
      { wch: 20 }, // Owner
      { wch: 15 }, // Priority
      { wch: 20 }, // Environment
    ];
    worksheet['!cols'] = columnWidths;
    
    // Create a workbook
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KEDB Record');
    
    // Save the file
    const fileName = `KEDB_${record.errorId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
  
  // Format record for Excel export (flatten the structure)
  private formatRecordForExport(record: KebdRecord): any {
    return {
      'ID': record.errorId,
      'Title': record.title,
      'Description': record.description,
      'Root Cause': record.rootCause,
      'Impact': record.impact,
      'Category': record.category,
      'Subcategory': record.subcategory,
      'Workaround': record.workaround,
      'Resolution': record.resolution || 'N/A',
      'Status': record.status,
      'Date Identified': record.dateIdentified,
      'Last Updated': record.lastUpdated || 'N/A',
      'Linked Incidents': record.linkedIncidents || 'N/A',
      'Owner': record.owner,
      'Priority': record.priority,
      'Environment': record.environment,
      'Attachments': record.attachments || 'N/A'
    };
  }
  
  // Filter records based on search term
  get filteredRecords(): KebdRecord[] {
    if (!this.searchTerm.trim()) {
      return this.sortRecords(this.records);
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    return this.sortRecords(this.records.filter(record => 
      record.errorId.toLowerCase().includes(term) ||
      record.title.toLowerCase().includes(term) ||
      record.description.toLowerCase().includes(term) ||
      record.category.toLowerCase().includes(term) ||
      record.status.toLowerCase().includes(term) ||
      record.owner.toLowerCase().includes(term)
    ));
  }
  
  // Sort records based on field and direction
  sortRecords(records: KebdRecord[]): KebdRecord[] {
    return [...records].sort((a, b) => {
      const fieldA = a[this.sortField as keyof KebdRecord];
      const fieldB = b[this.sortField as keyof KebdRecord];
      
      if (fieldA === undefined || fieldB === undefined) {
        return 0;
      }
      
      let comparison = 0;
      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        comparison = fieldA.localeCompare(fieldB);
      } else {
        comparison = fieldA > fieldB ? 1 : fieldA < fieldB ? -1 : 0;
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  // Change sort field and direction
  sort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
  }
  
  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }
}