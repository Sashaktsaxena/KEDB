import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterOutlet, RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';

import { KebdService } from './kebd.service';
import { FormsModule } from '@angular/forms'; // Add this import

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterOutlet, 
    RouterModule,
    FormsModule  // Add this import to the component
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  kebdForm!: FormGroup;
  currentStep = 0;
  totalSteps = 4;
  submitted = false;
  success = false;
  error = '';
  isAnimating = false; 
  formFields: FormField[][] = [
    [
      { name: 'category', label: 'Category', type: 'select', options: ['Application', 'Backend', 'Infrastructure', 'Database'], validators: [Validators.required] },
      { 
        name: 'subcategory', 
        label: 'Subcategory', 
        type: 'select', 
        options: [
          'UI/UX Issues',
          'Performance',
          'Authentication',
          'Authorization',
          'API Integration',
          'Server Configuration',
          'Network Issues',
          'Data Corruption',
          'Query Performance',
          'Connection Issues'
        ], 
        validators: [Validators.required] 
      },
      { name: 'environment', label: 'Environment', type: 'select', options: ['Development', 'Testing', 'UAT', 'Production'], validators: [Validators.required] },
      { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], validators: [Validators.required] }
    ],
    // Step 1 - Basic Information
    [
      { name: 'title', label: 'Title', type: 'text', validators: [Validators.required] },
      { name: 'description', label: 'Description', type: 'textarea', validators: [Validators.required] },
      { name: 'dateIdentified', label: 'Date Identified', type: 'date', validators: [Validators.required] }
    ],
    // Step 2 - Classification
    
    // Step 3 - Technical Details
    [
      { name: 'rootCause', label: 'Root Cause', type: 'textarea', validators: [Validators.required] },
      { name: 'impact', label: 'Impact', type: 'textarea', validators: [Validators.required] },
      { name: 'workaround', label: 'Workaround', type: 'textarea', validators: [Validators.required] },
      { name: 'resolution', label: 'Resolution', type: 'textarea', validators: [] }
    ],
    // Step 4 - Management
    [
      { name: 'status', label: 'Status', type: 'select', options: ['Open', 'Investigating', 'Resolved', 'Closed'], validators: [Validators.required] },
      { 
        name: 'owner', 
        label: 'Owner', 
        type: 'select', 
        options: [], 
        validators: [Validators.required] ,
  
      },
      { name: 'linkedIncidents', label: 'Linked Incidents', type: 'text', validators: [] },
      
    ]
  ];
  users:any[] = [];
  loadingUsers: boolean = false;
  selectedFiles: File[] = [];
  isDraggingOver: boolean = false;
  uploadProgress: number = 0;
  isUploading: boolean = false;
  fileComments: string[] = [];
  draftId: number | null = null;
draftErrorId: string | null = null;
notification: { message: string, type: 'success' | 'warning' | 'error', visible: boolean } = {
  message: '',
  type: 'success',
  visible: false
};
  @ViewChild('textArea') textArea!: ElementRef;

  constructor(
    private fb: FormBuilder, 
    private kebdService: KebdService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Initialize the form with all fields
    console.log('component initialized');
    const formGroupConfig: Record<string, any> = {};
    this.formFields.flat().forEach(field => {
      if (field.name === 'status') {
      formGroupConfig[field.name] = ['Open', field.validators]; // Set 'Open' as default
    } else {
      formGroupConfig[field.name] = ['', field.validators];
    }
    });
    this.kebdForm = this.fb.group(formGroupConfig);
    
    // Calculate total steps
    this.totalSteps = this.formFields.length;
    this.loadUsers();
      this.route.queryParams.subscribe(params => {
    if (params['draftId']) {
      this.loadDraft(parseInt(params['draftId'], 10));
    }
  });
  }

  // Navigate to next step with animation
  next() {
      if (this.draftId !== null) {
    // Start fade-out animation
    this.isAnimating = true;
    
    // Wait for animation to complete before changing step
    setTimeout(() => {
      this.currentStep++;
      // Reset animation state after a brief delay to trigger fade-in
      setTimeout(() => {
        this.isAnimating = false;
      }, 50);
    }, 300); // Match this with the CSS transition duration
    return;
  }
    // Check if current step's fields are valid
    const currentFields = this.formFields[this.currentStep].map(field => field.name);
    const stepValid = currentFields.every(field => {
      const control = this.kebdForm.get(field);
      return control && (control.valid || !control.errors?.['required']);
    });

    if (stepValid) {
      // Start fade-out animation
      this.isAnimating = true;
      
      // Wait for animation to complete before changing step
      setTimeout(() => {
        this.currentStep++;
        // Reset animation state after a brief delay to trigger fade-in
        setTimeout(() => {
          this.isAnimating = false;
        }, 50);
      }, 300); // Match this with the CSS transition duration
    } else {
      // Mark fields as touched to show validation errors
      currentFields.forEach(field => {
        const control = this.kebdForm.get(field);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  }

  // Navigate to previous step with animation
  previous() {
    if (this.currentStep > 0) {
      // Start fade-out animation
      this.isAnimating = true;
      
      // Wait for animation to complete before changing step
      setTimeout(() => {
        this.currentStep--;
        // Reset animation state after a brief delay to trigger fade-in
        setTimeout(() => {
          this.isAnimating = false;
        }, 50);
      }, 300); // Match this with the CSS transition duration
    }
  }
  loadUsers() :void{
    this.loadingUsers = true;
    this.kebdService.getUsers().subscribe({
      next:(users)=>{
        this.users=users;
        this.loadingUsers=false;
        this.updateOwnerOptions();
      },
      error:(error)=>{
        console.error('Error Loading Users',error);
        this.loadingUsers = false;
      }
    })
  }
  loadDraft(draftId: number): void {
  this.kebdService.getDraft(draftId).subscribe({
    next: (draft) => {
      this.draftId = draft.id;
      this.draftErrorId = draft.errorId;
      
      // Populate form with draft data
      this.kebdForm.patchValue(draft.formData);
      
      // Set the current step
      if (draft.formData.currentStep !== undefined) {
        this.currentStep = draft.formData.currentStep;
      }
      
      // Load file comments if any
      if (draft.formData.fileComments) {
        this.fileComments = draft.formData.fileComments;
      }
      
      this.showNotification(`Draft "${draft.errorId}" loaded successfully`, 'success');
    },
    error: (error) => {
      console.error('Error loading draft:', error);
      this.showNotification('Failed to load draft', 'error');
    }
  });
}
saveAsDraft(): void {
  // Get the current form values - even if incomplete or invalid
  const formData = {
    ...this.kebdForm.value,
    draftId: this.draftId, // Include if updating an existing draft
    draftErrorId: this.draftErrorId, // Include if we already have a draft error ID
    currentStep: this.currentStep,
    fileComments: this.fileComments,
    selectedFiles: this.selectedFiles.map(file => file.name), // We can't store the files, just track their names
    timestamp: new Date().toISOString()
  };
  
  this.kebdService.saveDraft(formData).subscribe({
    next: (response) => {
      this.draftId = response.draftId;
      this.draftErrorId = response.errorId;
      this.showNotification(`Draft saved successfully as ${response.errorId}`, 'success');
      
      // Optionally, redirect to the drafts page after a delay
      setTimeout(() => {
        this.router.navigate(['/drafts']);
      }, 2000);
    },
    error: (error) => {
      console.error('Error saving draft:', error);
      this.showNotification('Failed to save draft', 'error');
    }
  });
}

// Add this notification method
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
  updateOwnerOptions():void{
    for (const stepFields of this.formFields){
      const ownerField=stepFields.find(field => field.name === 'owner');
      if(ownerField && this.users.length >0){
        ownerField.options=this.users.map(user => user.fullName);
      }
    }
  }
  // Check if field should be shown in current step
  isFieldInCurrentStep(fieldName: string): boolean {
    return this.formFields[this.currentStep].some(field => field.name === fieldName);
  }

  // Calculate progress percentage for the timeline
  get progressPercentage(): number {
    return (this.currentStep / (this.totalSteps - 1)) * 100;
  }

// Replace the current onSubmit method with this fixed version
onSubmit(): void {
  if (this.kebdForm.invalid) {
    // Mark all fields as touched to show validation errors
    Object.keys(this.kebdForm.controls).forEach(key => {
      const control = this.kebdForm.get(key);
      control?.markAsTouched();
    });
    return;
  }

  const formData = {
    ...this.kebdForm.value,
    lastUpdated: new Date().toISOString()
  };

  this.isUploading = true;
  this.uploadProgress = 0;
  const isDraftSubmission = !!this.draftId;
  // First submit the form data
  this.kebdService.createKebdRecord(formData).subscribe({
    next: (response) => {
      // Get the created record ID
      const recordId = response.id;
      if (isDraftSubmission) {
        this.kebdService.deleteDraft(this.draftId!).subscribe({
          next: () => console.log(`Successfully deleted draft ${this.draftId} after submission`),
          error: (error) => console.error(`Failed to delete draft ${this.draftId} after submission:`, error)
        });
      }
      if (this.selectedFiles.length === 0) {
        // No files to upload
        this.success = true;
        this.error = '';
        
        // Show success message briefly before redirecting
        setTimeout(() => {
          this.router.navigate(['/records']);
        }, 2000);
        return;
      }
      
      // Track upload progress
      let completedUploads = 0;
      const totalUploads = this.selectedFiles.length;
      
      // Process each file sequentially to ensure comments are preserved
      for (let i = 0; i < this.selectedFiles.length; i++) {
        const file = this.selectedFiles[i];
        // Ensure we have a string (not undefined)
        const comment = this.fileComments[i] || '';
        
        // Create FormData manually to debug
        const formData = new FormData();
        formData.append('file', file);
        formData.append('comment', comment);
        
        console.log(`Creating FormData for file ${i+1}/${totalUploads}: ${file.name}`);
        console.log(`Comment being added to FormData: "${comment}"`);
        
        // Use HttpClient directly for more control
        this.kebdService.http.post(
          `http://localhost:3000/api/kebd/${recordId}/attachments`, 
          formData,
          { reportProgress: true, observe: 'events' }
        ).subscribe({
          next: (event: any) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              const fileProgress = Math.round(100 * event.loaded / event.total);
              this.uploadProgress = Math.round((completedUploads * 100 + fileProgress) / totalUploads);
            } else if (event.type === HttpEventType.Response) {
              completedUploads++;
              this.uploadProgress = Math.round((completedUploads / totalUploads) * 100);
              
              console.log(`File ${i+1} uploaded successfully with comment: "${comment}"`);
              console.log('Server response:', event.body);
              
              if (completedUploads === totalUploads) {
                this.isUploading = false;
                this.success = true;
                
                setTimeout(() => {
                  this.router.navigate(['/records']);
                }, 2000);
              }
            }
          },
          error: (error: any) => {
            console.error(`Error uploading file ${i+1}:`, error);
            completedUploads++;
            
            if (completedUploads === totalUploads) {
              this.isUploading = false;
              this.success = true;
              this.error = 'Some files could not be uploaded';
              
              setTimeout(() => {
                this.router.navigate(['/records']);
              }, 2000);
            }
          }
        });
      }
    },
    error: (error) => {
      this.isUploading = false;
      this.error = 'Error submitting form. Please try again.';
      console.error('Error submitting form:', error);
    }
  });
}

  resetForm() {
    this.kebdForm.reset();
    this.currentStep = 0;
    this.submitted = false;
    this.success = false;
  }

  // Helper method to check if a field has errors
  hasError(fieldName: string): boolean {
    const field = this.kebdForm.get(fieldName);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  // Add a method to navigate to records view
  viewRecords() {
    this.router.navigate(['/records']);
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
    
    if (event.dataTransfer?.files) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(input.files);
    }
  }

  handleFiles(fileList: FileList): void {
    const newFiles = Array.from(fileList);
    
    // Check file size
    for (const file of newFiles) {
      if (file.size > 5 * 1024 * 1024) { // 5MB
        alert(`File "${file.name}" exceeds the 5MB size limit`);
        return;
      }
    }
    
    this.selectedFiles = [...this.selectedFiles, ...newFiles];
    
    // Add empty comments for each new file
    for (let i = 0; i < newFiles.length; i++) {
      this.fileComments.push('');
    }
  }

  removeFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);
    this.fileComments = this.fileComments.filter((_, i) => i !== index);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  getFileIconClass(file: File): string {
    const type = file.type;
    
    if (type.startsWith('image/')) return 'image';
    else if (type === 'application/pdf') return 'pdf';
    else if (type.includes('word') || type.includes('doc')) return 'doc';
    else if (type.includes('excel') || type.includes('sheet')) return 'spreadsheet';
    else if (type.includes('text/')) return 'text';
    else return '';
  }

}

// Add this interface definition
interface FormField {
  name: string;
  label: string;
  type: string;
  validators: ((control: AbstractControl<any, any>) => ValidationErrors | null)[];
  options?: string[]; // Make options optional with the ? modifier
}