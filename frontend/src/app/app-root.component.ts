import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { HeaderComponent } from './shared/header/header.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet,HeaderComponent],
  template: `
    <ng-container *ngIf="!isLoginPage()">
      <app-header></app-header>
    </ng-container>
    <router-outlet></router-outlet>
  `
})
export class AppRootComponent {
  // constructor(private authService: AuthService) {}
  isLoginPage(): boolean {
    return window.location.pathname === '/login' 
}
}