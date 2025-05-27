import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  userName: string = '';
  userRole: string = '';
  isDropdownOpen = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.userName = user.fullName;
        this.userRole = user.role;
      }
    });
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  logout() {
    this.authService.logout();
  }

  isAdmin(): boolean {
    return this.userRole === 'admin';
  }
}