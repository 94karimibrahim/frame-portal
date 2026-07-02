import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { credentialsInterceptor } from './credentials.interceptor';

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends credentials on auth endpoints (the httpOnly refresh cookie rides along)', () => {
    http.post('/api/auth/refresh', { refreshToken: '' }).subscribe();

    const req = httpMock.expectOne('/api/auth/refresh');
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);
  });

  it('leaves ordinary API calls credential-free', () => {
    http.get('/api/users').subscribe();

    const req = httpMock.expectOne('/api/users');
    expect(req.request.withCredentials).toBe(false);
    req.flush(null);
  });
});
