import { ApiConnectionError, isGlobalApiError, safeApiMessage } from '@/lib/apiErrors';

describe('API error helpers', () => {
  it('returns user-safe messages for known API errors', () => {
    expect(safeApiMessage(new ApiConnectionError('/profile'))).toBe(
      'Backend connection unavailable. Showing demo data where available.',
    );
    expect(safeApiMessage(new Error('Could not validate credentials'))).toBe('Could not validate credentials');
    expect(safeApiMessage(new Error('Specific backend failure'))).toBe('Specific backend failure');
  });

  it('classifies only transport failures as global errors', () => {
    expect(isGlobalApiError(new ApiConnectionError('/profile'))).toBe(true);
    expect(isGlobalApiError(new Error('Could not validate credentials'))).toBe(false);
    expect(isGlobalApiError(new Error('Specific backend failure'))).toBe(false);
  });

  it('falls back for unknown or empty errors', () => {
    expect(safeApiMessage(new Error('   '))).toBe('Unable to load this clinical operations view.');
    expect(safeApiMessage(null)).toBe('Unable to load this clinical operations view.');
  });
});
