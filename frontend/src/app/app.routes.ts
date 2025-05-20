import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./app.component').then(m => m.AppComponent) 
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