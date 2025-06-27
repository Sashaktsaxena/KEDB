import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './login/login.component';
import { DraftsComponent } from './drafts/drafts.component';
export const routes: Routes = [
  { 
    path: 'login', 
    component: LoginComponent
  },
  { 
    path: '', 
    loadComponent: () => import('./app.component').then(m => m.AppComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'records', 
    loadComponent: () => import('./records/records.component').then(m => m.RecordsComponent),
    canActivate: [AuthGuard]
  },
  { 
    path: 'unauthorized', 
    loadComponent: () => import('./unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
  { 
    path: 'bin', 
    loadComponent: () => import('./bin/bin.component').then(m => m.BinComponent),
    canActivate: [AuthGuard]
  },
    { 
    path: 'drafts', 
    component: DraftsComponent, 
    canActivate: [AuthGuard] 
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