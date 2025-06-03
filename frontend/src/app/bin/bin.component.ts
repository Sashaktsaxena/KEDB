import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { KebdService, KebdRecord, Attachment } from '../kebd.service';

@Component({
  selector: 'app-bin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './bin.component.html',
  styleUrls: ['./bin.component.css']
})
export class BinComponent implements OnInit {
  Math = Math;
  archivedRecords: KebdRecord[] = [];
  filteredRecords: KebdRecord[] = [];
  loading: boolean = true;
  error: string = '';
  
  // Record detail view
  selectedRecord: KebdRecord | null = null;
  showDetailView: boolean = false;
  attachments: Attachment[] = [];
  loadingAttachments: boolean = false;
  
  // Image viewer
  viewerOpen: boolean = false;
  currentViewerImage: string = '';
  
  // Status options
  statusOptions: string[] = ['Open', 'Investigating', 'Resolved', 'Closed'];
  searchTerm: string = '';
  
  // Add these properties
  @ViewChild('fileInput') fileInput!: ElementRef;
  uploadProgress: number = 0;
  
  // Add owners list
  ownerOptions: string[] = [
    'Rahul Sharma',
    'Priya Patel',
    'Amit Singh',
    'Meera Desai',
    'Vikram Reddy'
  ];
  
  // Add pagination properties
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50, 100];
  totalPages: number = 1;
  
  constructor(private kebdService: KebdService) { }

  ngOnInit(): void {
    this.loadArchivedRecords();
  }

  loadArchivedRecords(): void {
    this.loading = true;
    this.kebdService.getArchivedRecords().subscribe({
      next: (records) => {
        this.archivedRecords = records;
        this.filteredRecords = records;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load archived records. Please try again.';
        this.loading = false;
        console.error('Error loading archived records:', error);
      }
    });
  }

  // Filter records based on search term and apply pagination
  applyFilter(): void {
    // First apply search filtering
    let filtered = this.archivedRecords;
    
    if (this.searchTerm.trim()) {
      const searchTerm = this.searchTerm.toLowerCase().trim();
      filtered = this.archivedRecords.filter(record => 
        (record.errorId && record.errorId.toLowerCase().includes(searchTerm)) ||
        record.title.toLowerCase().includes(searchTerm) ||
        record.category.toLowerCase().includes(searchTerm) ||
        record.subcategory.toLowerCase().includes(searchTerm) ||
        record.owner.toLowerCase().includes(searchTerm) ||
        record.status.toLowerCase().includes(searchTerm)
      );
    }
    
    // Calculate total pages
    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    
    // Adjust current page if needed
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    
    // Apply pagination
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.filteredRecords = filtered.slice(startIndex, startIndex + this.pageSize);
  }

  // Open record details
  openRecordDetails(record: KebdRecord): void {
    this.selectedRecord = { ...record }; // Create a copy to avoid direct mutation
    this.showDetailView = true;
    this.loadAttachments(record.id!);
  }

  // Load attachments for a record
  loadAttachments(recordId: number): void {
    this.loadingAttachments = true;
    this.attachments = [];
    
    this.kebdService.getAttachments(recordId).subscribe({
      next: (data) => {
        this.attachments = data;
        this.loadingAttachments = false;
      },
      error: (error) => {
        console.error('Error loading attachments:', error);
        this.loadingAttachments = false;
      }
    });
  }

  // Close detail view
  closeDetailView(): void {
    this.showDetailView = false;
    this.selectedRecord = null;
    this.attachments = [];
  }

  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  // Update record status
  updateStatus(): void {
    if (!this.selectedRecord) return;
    
    this.loading = true;
    
    // First update status
    this.kebdService.updateRecordStatus(
      this.selectedRecord.id!, 
      this.selectedRecord.status
    ).subscribe({
      next: () => {
        // Then update owner if it has changed
        const index = this.archivedRecords.findIndex(r => r.id === this.selectedRecord!.id);
        if (index!=-1){
          this.archivedRecords[index].status = this.selectedRecord!.status;
        }
        this.updateOwner();
      },
      error: (error) => {
        this.error = 'Failed to update record status. Please try again.';
        this.loading = false;
        console.error('Error updating record status:', error);
      }
    });
  }
  
  // Add method to update owner
  updateOwner(): void {
    if (!this.selectedRecord) {
      this.loading = false;
      return;
    }
    
    this.kebdService.updateRecordOwner(
      this.selectedRecord.id!,
      this.selectedRecord.owner
    ).subscribe({
      next: () => {
        // Update the record in the list
        const index = this.archivedRecords.findIndex(r => r.id === this.selectedRecord!.id);
        if (index !== -1) {
          this.archivedRecords[index].owner = this.selectedRecord!.owner;
        }
        
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to update record owner. Please try again.';
        this.loading = false;
        console.error('Error updating record owner:', error);
      }
    });
  }

  // Restore record (change status from Archived)
  restoreRecord(): void {
    if (!this.selectedRecord) return;
    
    this.selectedRecord.status = 'Open';
    this.updateStatus();
  }

  // Delete record permanently
  deleteRecordPermanently(): void {
    if (!this.selectedRecord || !confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) return;
    
    this.loading = true;
    
    this.kebdService.deleteKebdRecord(this.selectedRecord.id!).subscribe({
      next: () => {
        // Remove the record from the lists
        this.archivedRecords = this.archivedRecords.filter(r => r.id !== this.selectedRecord!.id);
        this.applyFilter(); // Refresh filtered records
        this.closeDetailView();
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to delete record. Please try again.';
        this.loading = false;
        console.error('Error deleting record:', error);
      }
    });
  }
  
  // Attachment handling methods
  isImageFile(attachment: Attachment): boolean {
    return attachment.file_type.startsWith('image/');
  }

  getAttachmentUrl(attachmentId: number): string {
    return this.kebdService.getAttachmentUrl(attachmentId);
  }

  getAttachmentIconClass(attachment: Attachment): string {
    const type = attachment.file_type;
    
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('word') || type.includes('doc')) return 'doc';
    if (type.includes('excel') || type.includes('sheet')) return 'spreadsheet';
    if (type.includes('text/')) return 'text';
    return 'other';
  }

  getFileExtension(filename: string): string {
    const ext = filename.split('.').pop();
    return ext ? ext.toUpperCase() : '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  openAttachment(attachment: Attachment): void {
    if (this.isImageFile(attachment)) {
      this.currentViewerImage = this.getAttachmentUrl(attachment.id);
      this.viewerOpen = true;
    } else {
      // For non-image files, open in a new window/tab
      window.open(this.getAttachmentUrl(attachment.id), '_blank');
    }
  }

  closeViewer(): void {
    this.viewerOpen = false;
    this.currentViewerImage = '';
  }
  
  deleteAttachment(attachmentId: number): void {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    
    this.kebdService.deleteAttachment(attachmentId).subscribe({
      next: () => {
        this.attachments = this.attachments.filter(a => a.id !== attachmentId);
      },
      error: (error) => {
        console.error('Error deleting attachment:', error);
        alert('Failed to delete attachment. Please try again.');
      }
    });
  }
  
  // Add file selection method
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (!input.files || input.files.length === 0) {
      return;
    }
    
    const file = input.files[0];
    this.uploadAttachment(file);
  }
  
  // Add file upload method
  uploadAttachment(file: File): void {
    if (!this.selectedRecord || !this.selectedRecord.id) {
      this.error = 'Cannot upload attachment: No record selected';
      return;
    }
    
    this.uploadProgress = 0;
    
    this.kebdService.uploadAttachment(this.selectedRecord.id, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round(100 * event.loaded / event.total);
        } else if (event instanceof HttpResponse) {
          // Upload complete, refresh attachments
          setTimeout(() => {
            this.uploadProgress = 0;
            this.loadAttachments(this.selectedRecord!.id!);
          }, 500);
        }
      },
      error: (error) => {
        this.uploadProgress = 0;
        console.error('Error uploading attachment:', error);
        this.error = 'Failed to upload attachment. Please try again.';
      }
    });
  }

  // Change the current page
  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    
    this.currentPage = page;
    this.applyFilter();
  }

  // Change the page size
  changePageSize(): void {
    this.currentPage = 1; // Reset to first page when changing page size
    this.applyFilter();
  }
}