describe('Mobile App Setup', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to date-fns', () => {
    const { format } = require('date-fns');
    const date = new Date('2024-01-15');
    expect(format(date, 'yyyy-MM-dd')).toBe('2024-01-15');
  });

  it('should have access to zustand', () => {
    const { create } = require('zustand');
    expect(typeof create).toBe('function');
  });
});