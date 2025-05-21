// src/app/auth/auth.guard.ts
import { Injectable } from '@angular/core';
import { 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router
} from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    if (this.authService.isLoggedIn()) {
      // Check if route requires admin role
      if (route.data['requiresAdmin'] && !this.authService.isAdmin()) {
        this.router.navigate(['/unauthorized']);
        return false;
      }
      return true;
    }

    // Store attempted URL for redirecting
    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}