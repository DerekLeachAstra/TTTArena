import { vi } from 'vitest';

/**
 * Chainable mock for supabase client.
 * Usage: mockSupabase.from('table').select('*').eq('col', val) etc.
 * Call mockSupabase.__setData(data) to set what the chain resolves to.
 */
function createChain(data = [], error = null) {
  const result = { data, error, count: data?.length ?? 0 };
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve) => resolve(result),
  };
  // Make chainable methods also act as thenables
  Object.keys(chain).forEach(key => {
    if (key !== 'then' && key !== 'single') {
      const orig = chain[key];
      chain[key] = vi.fn((...args) => {
        orig(...args);
        return chain;
      });
    }
  });
  return chain;
}

let __mockData = [];
let __mockError = null;

export const mockSupabase = {
  from: vi.fn(() => createChain(__mockData, __mockError)),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signInAnonymously: vi.fn(),
  },
  __setData(data, error = null) { __mockData = data; __mockError = error; },
  __reset() { __mockData = []; __mockError = null; },
};

// Auto-mock the supabase module
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }));
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }));
