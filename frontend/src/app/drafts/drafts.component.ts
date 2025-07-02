import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KebdService } from '../kebd.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-drafts',
  templateUrl: './drafts.component.html',
  styleUrls: ['./drafts.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class DraftsComponent implements OnInit {
  drafts: any[] = [];
  loading: boolean = true;
  searchQuery: string = '';
  
  showSubmitModal: boolean = false;
  showDeleteModal: boolean = false;
  
  selectedDraft: any = null;
  draftToSubmitId: number | null = null;
  draftToDeleteId: number | null = null;
  
  submitLoading: boolean = false;
  deleteLoading: boolean = false;
  
  notification: { message: string, type: 'success' | 'warning' | 'error', visible: boolean } = {
    message: '',
    type: 'success',
    visible: false
  };

  constructor(
    private kebdService: KebdService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadDrafts();
  }
navigateToNewRecord(): void {
  this.router.navigate(['/']);
}
  loadDrafts(): void {
    this.loading = true;
    this.kebdService.getDrafts().subscribe({
      next: (data) => {
        this.drafts = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading drafts:', error);
        this.loading = false;
        this.showNotification('Failed to load drafts', 'error');
      }
    });
  }

  get filteredDrafts(): any[] {
    if (!this.searchQuery) {
      return this.drafts;
    }
    
    const query = this.searchQuery.toLowerCase();
    return this.drafts.filter(draft => 
      draft.errorId.toLowerCase().includes(query) || 
      draft.title.toLowerCase().includes(query) || 
      draft.category.toLowerCase().includes(query)
    );
  }

  editDraft(id: number): void {
    // Navigate to the form component with the draft ID as a query parameter
    this.router.navigate(['/'], { queryParams: { draftId: id } });
  }

  submitDraft(id: number): void {
    // Find the draft to submit
    const draft = this.drafts.find(d => d.id === id);
    if (draft) {
      this.selectedDraft = draft;
      this.draftToSubmitId = id;
      this.showSubmitModal = true;
    }
  }

  deleteDraft(id: number): void {
    this.draftToDeleteId = id;
    this.showDeleteModal = true;
  }

  cancelSubmit(): void {
    this.showSubmitModal = false;
    this.draftToSubmitId = null;
    this.selectedDraft = null;
  }

confirmSubmit(): void {
  if (!this.draftToSubmitId) {
    return;
  }
  
  this.submitLoading = true;
  
  // Get the full draft data first
  this.kebdService.getDraft(this.draftToSubmitId).subscribe({
    next: (draftData) => {
      // Create submission data including any attachments
      const submissionData = {
        ...draftData.formData,
        // Include any attachment information from the draft
        attachments: draftData.formData.attachments || [],
        selectedFiles: draftData.formData.selectedFiles || [],
        fileComments: draftData.formData.fileComments || []
      };
      
      // Submit the draft as a complete record
      this.kebdService.submitDraft(this.draftToSubmitId!, submissionData).subscribe({
        next: (response) => {
          this.submitLoading = false;
          this.showSubmitModal = false;
          
          // Remove the draft from the list
          this.drafts = this.drafts.filter(d => d.id !== this.draftToSubmitId);
          
          this.showNotification(`Draft successfully submitted as record ${response.errorId}`, 'success');
          
          // Reset state
          this.draftToSubmitId = null;
          this.selectedDraft = null;
          
          // After a brief delay, navigate to the records page
          setTimeout(() => {
            this.router.navigate(['/records']);
          }, 2000);
        },
        error: (error) => {
          console.error('Error submitting draft:', error);
          this.submitLoading = false;
          this.showNotification('Failed to submit draft: ' + (error.error?.message || 'Unknown error'), 'error');
        }
      });
    },
    error: (error) => {
      console.error('Error getting draft data:', error);
      this.submitLoading = false;
      this.showNotification('Failed to get draft data: ' + (error.error?.message || 'Unknown error'), 'error');
    }
  });
}

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.draftToDeleteId = null;
  }

  confirmDelete(): void {
    if (!this.draftToDeleteId) {
      return;
    }
    
    this.deleteLoading = true;
    
    this.kebdService.deleteDraft(this.draftToDeleteId).subscribe({
      next: () => {
        // Remove the draft from the list
        this.drafts = this.drafts.filter(d => d.id !== this.draftToDeleteId);
        
        this.deleteLoading = false;
        this.showDeleteModal = false;
        this.draftToDeleteId = null;
        
        this.showNotification('Draft deleted successfully', 'success');
      },
      error: (error) => {
        console.error('Error deleting draft:', error);
        this.deleteLoading = false;
        this.showNotification('Failed to delete draft', 'error');
      }
    });
  }

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
}