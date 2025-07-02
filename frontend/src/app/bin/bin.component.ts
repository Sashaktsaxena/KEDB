import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { KebdService, KebdRecord, Attachment } from '../kebd.service';
import { response } from 'express';

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
  showRevertModal: boolean = false;
revertNotes: string = '';
revertLoading: boolean = false;
previousAssignee: string = '';
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
  users: any[] = [];
loadingUsers: boolean = false;
  // Add pagination properties
  pageSize: number = 10;
pageSizeOptions: number[] = [5, 10, 25, 50, 100];
totalPages: number = 1;
currentPage: number = 1;
paginationRange: number[] = [];
customPageSize: number = 0;
customPageSizeInput: number = 0;
showCustomPageSizeInput: boolean = false;
  
  // Add these properties to your class
  assignmentHistory: any[] = [];
  loadingHistory: boolean = false;
  showAssignDialog: boolean = false;
  assignToUser: string = '';
  assignDueDate: string = '';
  assignmentNotes: string = '';
  assignLoading: boolean = false;
  
  // Add these properties to the BinComponent class
  showUploadModal: boolean = false;
  selectedFile: File | null = null;
  attachmentComment: string = '';
  isUploading: boolean = false;
  isDraggingOver: boolean = false;
  
  showRejectModal: boolean = false;
rejectReason: string = '';
rejectReasonError: string = '';
rejectLoading: boolean = false;

  constructor(private kebdService: KebdService) { }

ngOnInit(): void {
  this.loadArchivedRecords();
  this.loadUsers();
}

  loadArchivedRecords(): void {
    this.loading = true;
    this.kebdService.getArchivedRecords().subscribe({
      next: (records) => {
        this.archivedRecords = records;
        this.filteredRecords = records;
        this.loading = false;
        console.log('Loaded records:', records);
      if (records.length > 0) {
        console.log('First record:', records[0]);
        console.log('First record error ID:', records[0].errorId);
      }
      },
      error: (error) => {
        this.error = 'Failed to load archived records. Please try again.';
        this.loading = false;
        console.error('Error loading archived records:', error);
      }
    });
  }
  loadUsers(): void {
  this.loadingUsers = true;
  this.kebdService.getUsers().subscribe({
    next: (users) => {
      this.users = users;
      this.loadingUsers = false;
       console.log('Loaded users:', this.users);
    },
    error: (error) => {
      console.error('Error loading users:', error);
      this.loadingUsers = false;
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
    
    // Save the filtered records
    this.filteredRecords = filtered;
    
    // Calculate total pages
    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    
    // Adjust current page if needed
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    
    // Update pagination range
    this.updatePaginationRange();
  }

  // Open record details
  openRecordDetails(record: KebdRecord): void {
      console.log('Opening record details:', record);
  console.log('Date identified:', record.dateIdentified);
  console.log('Last updated:', record.lastUpdated);
    this.selectedRecord = record;
    this.showDetailView = true;
    
    if (record.id) {
      this.loadAttachments(record.id);
      this.loadAssignmentHistory(record.id);
    }
  }
// Add this to bin.component.ts

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

  // Add method to load assignment history
  // Update this method to handle the new response format
loadAssignmentHistory(recordId: number): void {
  this.loadingHistory = true;
  this.kebdService.getAssignmentHistory(recordId).subscribe({
    next: (data) => {
      this.assignmentHistory = data.history;
      
      // Update record with owner and assignee info
      if (this.selectedRecord) {
        // If owner data is available from response
        if (data.owner) {
          this.selectedRecord.originalOwner = data.owner.name;
        }
        
        // If current assignee data is available
        if (data.currentAssignee) {
          this.selectedRecord.currentAssignee = data.currentAssignee.name;
          this.selectedRecord.dueDate = data.currentAssignee.dueDate || undefined;
          
          // Calculate days remaining if due date exists
          if (data.currentAssignee.dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const due = new Date(data.currentAssignee.dueDate);
            due.setHours(0, 0, 0, 0);
            
            const diffTime = due.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            this.selectedRecord.daysRemaining = diffDays;
          }
        }
      }
      
      this.loadingHistory = false;
    },
    error: (error) => {
      console.error('Error loading assignment history:', error);
      this.loadingHistory = false;
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
// Update this method in bin.component.ts
formatDate(dateString: string | undefined | null): string {
  console.log('Formatting date:', dateString);
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (e) {
    console.error('Error formatting date:', dateString, e);
    return 'N/A';
  }
}


  // Format date with time
  formatDateTime(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
showRevertDialog(): void {
  if (!this.selectedRecord || this.assignmentHistory.length <= 1) {
    this.showNotification('No previous assignment found for this record', 'warning');
    return;
  }
  
  // Find the previous assignee (the second item in the history, since it's ordered by most recent first)
  this.previousAssignee = this.assignmentHistory[1].newAssignee;
  
  // Close the assign dialog if it's open
  this.showAssignDialog = false;
  
  // Open the revert dialog
  this.showRevertModal = true;
  this.revertNotes = '';
}
showRejectDialog(): void {
  if (!this.selectedRecord) {
    return;
  }
  
  this.showRejectModal = true;
  this.rejectReason = '';
  this.rejectReasonError = '';
}

// Handle record rejection
rejectRecord(): void {
  if (!this.selectedRecord) {
    return;
  }
  
  // Validate rejection reason
  if (!this.rejectReason.trim()) {
    this.rejectReasonError = 'A detailed rejection reason is required';
    return;
  }
  
  this.rejectLoading = true;
  
  // Call API to reject the record
  this.kebdService.rejectAndDeleteRecord(
    this.selectedRecord.id!, 
    this.rejectReason
  ).subscribe({
    next: (response) => {
      // Remove the record from the lists
      this.archivedRecords = this.archivedRecords.filter(r => r.id !== this.selectedRecord!.id);
      
      // Reset form and close dialog
      this.showRejectModal = false;
      this.rejectLoading = false;
      this.rejectReason = '';
      
      // Refresh the view
      this.applyFilter();
      this.closeDetailView();
      
      // Show success notification
      this.showNotification('Record has been rejected and deleted. Notification emails have been sent to all assigned users.', 'success');
    },
    error: (error) => {
      console.error('Error rejecting record:', error);
      this.rejectLoading = false;
      this.showNotification('Failed to reject record: ' + (error.error?.message || 'Unknown error'), 'error');
    }
  });
}
// Add this method to handle the revert operation
revertRecord(): void {
  if (!this.selectedRecord || !this.revertNotes.trim()) {
    this.showNotification('Please provide a reason for reverting', 'warning');
    return;
  }
  
  this.revertLoading = true;
  
  this.kebdService.revertAssignment(
    this.selectedRecord.id!,
    this.revertNotes
  ).subscribe({
    next: (response) => {
      // Update the record owner to the previous assignee
      this.selectedRecord!.owner = this.previousAssignee;
      
      // Reset form and close dialog
      this.showRevertModal = false;
      this.revertLoading = false;
      this.revertNotes = '';
      this.previousAssignee = '';
      
      // Reload assignment history
      this.loadAssignmentHistory(this.selectedRecord!.id!);
      
      this.showNotification('Record assignment reverted successfully', 'success');
    },
    error: (error) => {
      console.error('Error reverting assignment:', error);
      this.revertLoading = false;
      this.showNotification('Failed to revert assignment: ' + (error.error?.message || 'Unknown error'), 'error');
    }
  });
}
  // Get minimum due date (today)
  getMinDueDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Get due status class
  getDueStatusClass(dueDate: string | undefined): string {
    if (!dueDate) return 'no-date';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due-today';
    if (diffDays <= 2) return 'due-soon';
    return 'on-track';
  }

  // Get due status text
 getDueStatusText(daysRemaining: number | undefined): string {
  if (daysRemaining === undefined || daysRemaining === null) return '';
  if (daysRemaining < 0) return `Overdue by ${Math.abs(daysRemaining)} day(s)`;
  if (daysRemaining === 0) return 'Due today';
  if (daysRemaining === 1) return 'Due tomorrow';
  return `${daysRemaining} days remaining`;
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

notification: { message: string, type: 'success' | 'warning' | 'error', visible: boolean } = {
  message: '',
  type: 'success',
  visible: false
};

showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success'): void {
  this.notification = {
    message,
    type,
    visible: true
  };
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    this.notification.visible = false;
  }, 5000);
}
  // Assign record method
assignRecord(): void {
  if (!this.selectedRecord || !this.assignToUser) {
    console.error('Cannot assign: Missing record or user', {
      record: this.selectedRecord?.id,
      user: this.assignToUser
    });
    return;
  }
  
  console.log('Assigning record to:', this.assignToUser); // Debug log
  
  this.assignLoading = true;
  
  this.kebdService.assignRecord(
    this.selectedRecord.id!, 
    this.assignToUser, 
    this.assignDueDate, 
    this.assignmentNotes
  ).subscribe({
    next: () => {
        // Update the record owner
        this.selectedRecord!.owner = this.assignToUser;
        
        // If we have a due date, update it
        if (this.assignDueDate) {
          this.selectedRecord!.dueDate = this.assignDueDate;
          
          // Calculate days remaining
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const due = new Date(this.assignDueDate);
          due.setHours(0, 0, 0, 0);
          
          const diffTime = due.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          this.selectedRecord!.daysRemaining = diffDays;
        }
        
        // Reset form and close dialog
        this.showAssignDialog = false;
        this.assignLoading = false;
        this.assignToUser = '';
        this.assignDueDate = '';
        this.assignmentNotes = '';
        
        // Reload assignment history
        this.loadAssignmentHistory(this.selectedRecord!.id!);
      },
      error: (error) => {
        console.error('Error assigning record:', error);
        this.assignLoading = false;
        this.error = 'Failed to assign record. Please try again.';
      }
    });
  }

  // Add these methods to the BinComponent class
showUploadDialog(): void {
  this.showUploadModal = true;
  this.selectedFile = null;
  this.attachmentComment = '';
}

onDragOver(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  this.isDraggingOver = true;
}

onDragLeave(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  this.isDraggingOver = false;
}

onDrop(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  this.isDraggingOver = false;
  
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    this.selectedFile = event.dataTransfer.files[0];
  }
}

getSelectedFileIconClass(): string {
  if (!this.selectedFile) return '';
  
  const type = this.selectedFile.type;
  
  if (type.startsWith('image/')) return 'image';
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('word') || type.includes('doc')) return 'doc';
  if (type.includes('excel') || type.includes('sheet')) return 'spreadsheet';
  if (type.includes('text/')) return 'text';
  return 'other';
}

uploadAttachmentWithComment(): void {
  if (!this.selectedRecord || !this.selectedRecord.id || !this.selectedFile) {
    this.error = 'Cannot upload attachment: No record or file selected';
    return;
  }
  
  this.isUploading = true;
  this.uploadProgress = 0;
  
  this.kebdService.uploadAttachmentWithComment(
    this.selectedRecord.id, 
    this.selectedFile, 
    this.attachmentComment
  ).subscribe({
    next: (event) => {
      if (event.type === HttpEventType.UploadProgress && event.total) {
        this.uploadProgress = Math.round(100 * event.loaded / event.total);
      } else if (event instanceof HttpResponse) {
        // Upload complete, reset and refresh
        setTimeout(() => {
          this.uploadProgress = 0;
          this.isUploading = false;
          this.selectedFile = null;
          this.attachmentComment = '';
          this.showUploadModal = false;
          this.loadAttachments(this.selectedRecord!.id!);
        }, 500);
      }
    },
    error: (error) => {
      this.uploadProgress = 0;
      this.isUploading = false;
      console.error('Error uploading attachment:', error);
      this.error = 'Failed to upload attachment. Please try again.';
    }
  });
}

// Add this method to update pagination range
updatePaginationRange(): void {
  this.paginationRange = [];
  const maxPagesToShow = 5;
  
  if (this.totalPages <= maxPagesToShow) {
    // If total pages is less than max to show, display all pages
    for (let i = 1; i <= this.totalPages; i++) {
      this.paginationRange.push(i);
    }
  } else {
    // Always show first page
    this.paginationRange.push(1);
    
    // Calculate start and end of the range
    let start = Math.max(2, this.currentPage - 1);
    let end = Math.min(this.totalPages - 1, this.currentPage + 1);
    
    // Adjust to show 3 pages in the middle
    if (start === 2) end = Math.min(4, this.totalPages - 1);
    if (end === this.totalPages - 1) start = Math.max(2, this.totalPages - 3);
    
    // Add ellipsis if needed
    if (start > 2) this.paginationRange.push(-1); // -1 represents ellipsis
    
    // Add the middle pages
    for (let i = start; i <= end; i++) {
      this.paginationRange.push(i);
    }
    
    // Add ellipsis if needed
    if (end < this.totalPages - 1) this.paginationRange.push(-1); // -1 represents ellipsis
    
    // Always show last page
    this.paginationRange.push(this.totalPages);
  }
}

// Add these pagination control methods
goToPage(page: number): void {
  if (page >= 1 && page <= this.totalPages) {
    this.currentPage = page;
    this.applyFilter();
  }
}

nextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
    this.applyFilter();
  }
}

previousPage(): void {
  if (this.currentPage > 1) {
    this.currentPage--;
    this.applyFilter();
  }
}

changePageSize(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const value = select.value;
  
  if (value === 'custom') {
    this.showCustomPageSizeInput = true;
    this.customPageSizeInput = this.pageSize;
  } else {
    this.pageSize = parseInt(value, 10);
    this.currentPage = 1; // Reset to first page
    this.applyFilter();
  }
}

applyCustomPageSize(): void {
  if (this.customPageSizeInput > 0) {
    this.pageSize = this.customPageSizeInput;
    this.showCustomPageSizeInput = false;
    this.currentPage = 1; // Reset to first page
    this.applyFilter();
  }
}

cancelCustomPageSize(): void {
  this.showCustomPageSizeInput = false;
}

// Add a computed property for paginated records
get paginatedRecords(): KebdRecord[] {
  const startIndex = (this.currentPage - 1) * this.pageSize;
  return this.filteredRecords.slice(startIndex, startIndex + this.pageSize);
}
}