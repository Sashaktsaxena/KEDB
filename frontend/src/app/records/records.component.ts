import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KebdService, KebdRecord } from '../kebd.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './records.component.html',
  styleUrls: ['./records.component.css']
})
export class RecordsComponent implements OnInit {
  Math = Math; // Make Math available in template
  records: KebdRecord[] = [];
  filteredRecordsCache: KebdRecord[] = []; // Cache for filtered records
  loading: boolean = true;
  error: string = '';
  selectedRecord: KebdRecord | null = null;
  showDetailView: boolean = false;
  searchTerm: string = '';
  sortField: string = 'dateIdentified';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Pagination properties
  currentPage: number = 1;
  pageSize: number = 5; // Default to 5 records per page
  pageSizeOptions: number[] = [5, 10, 25, 50, 100];
  totalPages: number = 0;
  paginationRange: number[] = [];

  // Add these properties to your class
  customPageSizeInput: number = 0;
  showCustomPageSizeInput: boolean = false;
  customPageSize: string = 'custom';
  showFilters: boolean = false;
  dateFilter: { from: string | null; to: string | null } = { from: null, to: null };
  priorityFilter: string = '';

  constructor(private kebdService: KebdService) {}

  ngOnInit(): void {
    this.loadRecords();
  }

  loadRecords(): void {
    this.loading = true;
    this.kebdService.getKebdRecords().subscribe({
      next: (data) => {
        this.records = data;
        this.updatePagination(); // Call pagination update
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load records. Please try again later.';
        this.loading = false;
        console.error('Error loading records:', error);
      }
    });
  }

  // Your existing methods for viewing records, exporting, etc.
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
  exportAllToExcel(): void {
    if (this.records.length ===0){
      alert('No records available to export.');
      return ;
    }
    const recordsToExport=this.records.map(record=>this.formatRecordForExport(record));
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(recordsToExport);
    
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KEDB Record');
    
    // Save the file
    const fileName = `KEDB_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    let filtered = this.records;
    
    // Apply text search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(record => this.matchesSearchTerm(record));
    }
    
    // Apply date range filter
    if (this.dateFilter.from || this.dateFilter.to) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.dateIdentified);
        
        if (this.dateFilter.from && this.dateFilter.to) {
          const fromDate = new Date(this.dateFilter.from);
          const toDate = new Date(this.dateFilter.to);
          // Set toDate to end of day
          toDate.setHours(23, 59, 59, 999);
          return recordDate >= fromDate && recordDate <= toDate;
        } else if (this.dateFilter.from) {
          const fromDate = new Date(this.dateFilter.from);
          return recordDate >= fromDate;
        } else if (this.dateFilter.to) {
          const toDate = new Date(this.dateFilter.to);
          // Set toDate to end of day
          toDate.setHours(23, 59, 59, 999);
          return recordDate <= toDate;
        }
        
        return true;
      });
    }
    
    // Apply priority filter
    if (this.priorityFilter) {
      filtered = filtered.filter(record => record.priority === this.priorityFilter);
    }
    
    // Apply sorting
    const sorted = this.sortRecords(filtered);
    
    this.filteredRecordsCache = sorted;
    this.updatePagination();
    return sorted;
  }

  // Match search term against record fields
  matchesSearchTerm(record: KebdRecord): boolean {
    const term = this.searchTerm.toLowerCase().trim();
    return record.errorId.toLowerCase().includes(term) ||
      record.title.toLowerCase().includes(term) ||
      record.description.toLowerCase().includes(term) ||
      record.category.toLowerCase().includes(term) ||
      record.status.toLowerCase().includes(term) ||
      record.owner.toLowerCase().includes(term);
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
    
    // Reset to first page after sorting
    this.currentPage = 1;
    this.updatePagination();
  }
  
  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  // Pagination methods
  updatePagination(): void {
    const filteredCount = this.filteredRecordsCache.length;
    this.totalPages = Math.ceil(filteredCount / this.pageSize);
    
    // Reset to first page if current page is out of bounds
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    // Generate pagination range
    this.calculatePaginationRange();
  }

  calculatePaginationRange(): void {
    const range: number[] = [];
    const maxVisiblePages = 5; // Show max 5 page numbers
    
    if (this.totalPages <= maxVisiblePages) {
      // If we have fewer pages than max visible, show all pages
      for (let i = 1; i <= this.totalPages; i++) {
        range.push(i);
      }
    } else {
      // Otherwise, calculate the range around current page
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = startPage + maxVisiblePages - 1;
      
      if (endPage > this.totalPages) {
        endPage = this.totalPages;
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        range.push(i);
      }
    }
    
    this.paginationRange = range;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      // Scroll to top of table
      const tableEl = document.querySelector('.records-table');
      if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  changePageSize(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedValue = selectElement.value;
    
    if (selectedValue === 'custom') {
      // Show custom input field
      this.showCustomPageSizeInput = true;
      this.customPageSizeInput = this.pageSize; // Set current value as default
      return;
    }
    
    this.pageSize = Number(selectedValue);
    this.currentPage = 1; // Reset to first page
    this.updatePagination();
  }

  applyCustomPageSize(): void {
    if (this.customPageSizeInput && this.customPageSizeInput > 0) {
      // Apply the custom page size
      this.pageSize = Math.min(1000, this.customPageSizeInput); // Limit to 1000 max
      this.currentPage = 1; // Reset to first page
      this.showCustomPageSizeInput = false;
      this.updatePagination();
    }
  }

  cancelCustomPageSize(): void {
    this.showCustomPageSizeInput = false;
  }

  // Toggle filters panel
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  // Check if any filter is active
  isFilterActive(): boolean {
    return !!(this.dateFilter.from || this.dateFilter.to || this.priorityFilter);
  }

  // Get count of active filters for badge
  getActiveFilterCount(): number {
    let count = 0;
    if (this.dateFilter.from || this.dateFilter.to) count++;
    if (this.priorityFilter) count++;
    return count;
  }

  // Format date range for display in filter summary
  formatFilterDateRange(): string {
    if (this.dateFilter.from && this.dateFilter.to) {
      return `${this.formatDateShort(this.dateFilter.from)} to ${this.formatDateShort(this.dateFilter.to)}`;
    } else if (this.dateFilter.from) {
      return `From ${this.formatDateShort(this.dateFilter.from)}`;
    } else if (this.dateFilter.to) {
      return `Until ${this.formatDateShort(this.dateFilter.to)}`;
    }
    return '';
  }

  // Format date for filter display (shorter format)
  formatDateShort(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Clear date filters
  clearDateFilters(): void {
    this.dateFilter = { from: null, to: null };
    this.applyFilters();
  }

  // Clear priority filter
  clearPriorityFilter(): void {
    this.priorityFilter = '';
    this.applyFilters();
  }

  // Clear all filters
  clearAllFilters(): void {
    this.dateFilter = { from: null, to: null };
    this.priorityFilter = '';
    this.applyFilters();
  }

  // Apply all active filters
  applyFilters(): void {
    // This will trigger the filteredRecords getter
    this.currentPage = 1; // Reset to first page when filters change
    // Force update
    this.searchTerm = this.searchTerm + ' ';
    setTimeout(() => {
      this.searchTerm = this.searchTerm.trim();
    }, 0);
  }

  // Get paginated records to display in the current page
  get paginatedRecords(): KebdRecord[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredRecordsCache.slice(startIndex, startIndex + this.pageSize);
  }
}