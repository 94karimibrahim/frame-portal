import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppError } from '../models';
import { ClientErrorCodes, errorInterceptor } from './error.interceptor';

/**
 * The error interceptor is the single normalizer of every HTTP failure into an {@link AppError}. These
 * tests cover the envelope cases plus the backend's two out-of-band shapes: the plain-text IP-filter 403
 * and the body-less 429 carrying `Retry-After`.
 */
describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function failWith(
    flush: (req: ReturnType<HttpTestingController['expectOne']>) => void,
  ): Promise<AppError> {
    return new Promise((resolve) => {
      http.get('/api/thing').subscribe({ error: (e: AppError) => resolve(e) });
      flush(httpMock.expectOne('/api/thing'));
    });
  }

  it('maps a connection failure (status 0) to the network code', async () => {
    const err = await failWith((req) =>
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' }),
    );
    expect(err.status).toBe(0);
    expect(err.code).toBe(ClientErrorCodes.network);
  });

  it('maps a 429 with Retry-After to rateLimited and parses the back-off', async () => {
    const err = await failWith((req) =>
      req.flush(null, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '30' },
      }),
    );
    expect(err.status).toBe(429);
    expect(err.code).toBe(ClientErrorCodes.rateLimited);
    expect(err.retryAfterSeconds).toBe(30);
  });

  it('maps a plain-text 403 to the IP-blocked code', async () => {
    const err = await failWith((req) =>
      req.flush('Your IP is not allowed', { status: 403, statusText: 'Forbidden' }),
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe(ClientErrorCodes.ipBlocked);
    expect(err.detail).toBe('Your IP is not allowed');
  });

  it('extracts code, detail and field errors from a ValidationProblemDetails body', async () => {
    const err = await failWith((req) =>
      req.flush(
        {
          title: 'Validation',
          detail: 'One or more fields are invalid',
          errors: { Email: ['Email.Invalid'] },
        },
        { status: 400, statusText: 'Bad Request', headers: { 'X-Correlation-ID': 'cid-1' } },
      ),
    );
    expect(err.status).toBe(400);
    expect(err.code).toBe('Validation');
    expect(err.detail).toBe('One or more fields are invalid');
    expect(err.fieldErrors).toEqual({ Email: ['Email.Invalid'] });
    expect(err.correlationId).toBe('cid-1');
  });
});
