import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component'; // Add this import

export const routes: Routes = [
  { 
    path: '', 
    component: AppComponent // Use component instead of loadComponent for the root component
  },
  { 
    path: 'records', 
    loadComponent: () => import('./records/records.component').then(m => m.RecordsComponent) 
  },
  { 
    path: '**', 
    redirectTo: '' 
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }