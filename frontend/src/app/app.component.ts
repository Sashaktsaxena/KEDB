import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { finalize, forkJoin } from 'rxjs';
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

  @ViewChild('textArea') textArea!: ElementRef;

  constructor(
    private fb: FormBuilder, 
    private kebdService: KebdService,
    private router: Router
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
  }

  // Navigate to next step with animation
  next() {
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

    // First submit the form data
    this.kebdService.createKebdRecord(formData)
      .pipe(
        finalize(() => {
          if (this.selectedFiles.length === 0) {
            this.isUploading = false;
          }
        })
      )
      .subscribe({
        next: (response) => {
          // Get the created record ID
          const recordId = response.id;
          
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
          
          // Upload each file individually with its comment
          const uploadObservables = this.selectedFiles.map((file, index) => 
            this.kebdService.uploadAttachmentWithComment(recordId, file, this.fileComments[index])
          );
          
          // Execute all uploads in parallel
          forkJoin(uploadObservables)
            .pipe(
              finalize(() => {
                this.isUploading = false;
              })
            )
            .subscribe({
              next: (responses) => {
                this.success = true;
                this.error = '';
                
                // Show success message briefly before redirecting
                setTimeout(() => {
                  this.router.navigate(['/records']);
                }, 2000);
              },
              error: (error) => {
                this.error = 'Error uploading attachments. Record was saved but some files could not be uploaded.';
                console.error('Error uploading attachments:', error);
              }
            });
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

  // Format text in textarea
  formatText(fieldName: string, formatType: 'bold' | 'italic' | 'underline' | 'bullet'): void {
    // Get the textarea element
    const textareaEl = document.getElementById(fieldName) as HTMLTextAreaElement;
    if (!textareaEl) return;
    
    const control = this.kebdForm.get(fieldName);
    if (!control) return;
    
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const text = control.value || '';
    
    // Get the selected text
    const selectedText = text.substring(start, end);
    
    // Apply formatting based on type
    let formattedText = '';
    let cursorPosition = 0;
    
    if (selectedText.length === 0) {
      // No selection, insert placeholder text
      switch (formatType) {
        case 'bold':
          formattedText = '**bold text**';
          cursorPosition = start + 2;
          break;
        case 'italic':
          formattedText = '*italic text*';
          cursorPosition = start + 1;
          break;
        case 'underline':
          formattedText = '__underlined text__';
          cursorPosition = start + 2;
          break;
        case 'bullet':
          formattedText = '• List item';
          cursorPosition = start + 2;
          break;
      }
      
      // Insert the placeholder
      const newText = text.substring(0, start) + formattedText + text.substring(end);
      control.setValue(newText);
      
      // Set cursor position inside the formatting
      setTimeout(() => {
        textareaEl.focus();
        textareaEl.selectionStart = cursorPosition;
        textareaEl.selectionEnd = cursorPosition + (formattedText.length - (formatType === 'bullet' ? 2 : 4));
      });
    } else {
      // Format the selected text
      switch (formatType) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = `*${selectedText}*`;
          break;
        case 'underline':
          formattedText = `__${selectedText}__`;
          break;
        case 'bullet':
          // For multi-line selection, add bullet to each line
          if (selectedText.includes('\n')) {
            formattedText = selectedText
              .split('\n')
              .map((line: string): string => line.trim() ? `• ${line}` : line)
              .join('\n');
          } else {
            formattedText = `• ${selectedText}`;
          }
          break;
      }
      
      // Replace the selected text with formatted text
      const newText = text.substring(0, start) + formattedText + text.substring(end);
      control.setValue(newText);
      
      // Move cursor after the inserted text
      setTimeout(() => {
        textareaEl.focus();
        const newPosition = start + formattedText.length;
        textareaEl.selectionStart = newPosition;
        textareaEl.selectionEnd = newPosition;
      });
    }
  }

  // Helper method to parse and display formatted text when showing preview or details
  parseFormattedText(text: string): string {
    if (!text) return '';
    
    // Convert markdown to HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/__(.*?)__/g, '<u>$1</u>') // Underline
      .replace(/•\s(.*?)(?:\n|$)/g, '<li>$1</li>') // Bullet points
      .replace(/<li>(.*?)<\/li>/g, function(match) {
        return '<ul>' + match + '</ul>';
      });
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