
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

      if (route.data['requiresAdmin'] && !this.authService.isAdmin()) {
        this.router.navigate(['/unauthorized']);
        return false;
      }
      return true;
    }


    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}