import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app.routes';
import { AppRootComponent } from './app-root.component';
import { AuthInterceptor } from './auth/auth.interceptor';
import { HeaderComponent } from './shared/header/header.component';
@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRootComponent,
    HeaderComponent

  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppRootComponent]
})
export class AppModule { }