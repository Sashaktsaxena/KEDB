import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { KebdService } from './kebd.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterOutlet, RouterModule],
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
  formFields = [
    // Step 1 - Basic Information
    [
      // { name: 'errorId', label: 'ID', type: 'text', validators: [Validators.required] },
      { name: 'title', label: 'Title', type: 'text', validators: [Validators.required] },
      { name: 'description', label: 'Description', type: 'textarea', validators: [Validators.required] },
      { name: 'dateIdentified', label: 'Date Identified', type: 'date', validators: [Validators.required] }
    ],
    // Step 2 - Classification
    [
      { name: 'category', label: 'Category', type: 'select',options:['Application ','Backend'] ,validators: [Validators.required] },
      { name: 'subcategory', label: 'Subcategory', type: 'text', validators: [Validators.required] },
      { name: 'environment', label: 'Environment', type: 'select', options: ['Development', 'Testing', 'UAT', 'Production'], validators: [Validators.required] },
      { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], validators: [Validators.required] }
    ],
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
      { name: 'owner', label: 'Owner', type: 'text', validators: [Validators.required] },
      { name: 'linkedIncidents', label: 'Linked Incidents', type: 'text', validators: [] },
      { name: 'attachments', label: 'Attachments', type: 'text', validators: [] }
    ]
  ];

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
      formGroupConfig[field.name] = ['', field.validators];
    });
    this.kebdForm = this.fb.group(formGroupConfig);
    
    // Calculate total steps
    this.totalSteps = this.formFields.length;
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

  // Check if field should be shown in current step
  isFieldInCurrentStep(fieldName: string): boolean {
    return this.formFields[this.currentStep].some(field => field.name === fieldName);
  }

  // Calculate progress percentage for the timeline
  get progressPercentage(): number {
    return (this.currentStep / (this.totalSteps - 1)) * 100;
  }

  onSubmit() {
    this.submitted = true;

    // Check if form is valid
    if (this.kebdForm.invalid) {
      return;
    }

    // Add last updated date
    const formData = {
      ...this.kebdForm.value,
      lastUpdated: new Date().toISOString()
    };

    // Submit data to backend using the service
    this.kebdService.createKebdRecord(formData)
      .subscribe({
        next: (response) => {
          this.success = true;
          this.error = '';
          
          // Show success message briefly before redirecting
          setTimeout(() => {
            // Redirect to records page after successful submission
            this.router.navigate(['/records']);
          }, 2000); // Redirect after 2 seconds so user can see success message
        },
        error: (error) => {
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
}