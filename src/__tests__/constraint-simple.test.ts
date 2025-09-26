import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';

describe('ConstraintCollectionService - Basic', () => {
  it('should create service instance', () => {
    const mockUserRepo = {} as any;
    const mockTaskRepo = {} as any;
    const mockCalendarRepo = {} as any;
    
    const service = new ConstraintCollectionService(
      mockUserRepo,
      mockTaskRepo,
      mockCalendarRepo
    );
    
    expect(service).toBeDefined();
  });
});