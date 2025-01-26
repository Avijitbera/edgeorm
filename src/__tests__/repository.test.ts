import { Repository } from '../repository';
import { Connection } from '../connection';
import { Node, Property } from '../decorators';
// Jest is automatically available in the global scope in Jest tests
// No need to import from @jest/globals

// Mock the Connection class
jest.mock('../connection', () => {
  const mockSession = {
    run: jest.fn(),
    close: jest.fn(),
  };
  return {
    Connection: {
      getInstance: jest.fn(() => ({
        getSession: jest.fn(() => mockSession)
      }))
    }
  };
});

// Mock decorators
jest.mock('../decorators', () => ({
  getNodeMetadata: jest.fn(() => ({ label: 'TestNode' })),
  getPropertyMetadata: jest.fn(() => ({
    id: { type: 'string', primary: true },
    name: { type: 'string' }
  })),
  Node: jest.fn(),
  Property: jest.fn()
}));

@Node('TestNode')
class TestEntity {
  @Property()
  id!: string;

  @Property()
  name!: string;
}

describe('Repository', () => {
  let repository: Repository<TestEntity>;
  let mockSession: any;

  beforeEach(() => {
    repository = new Repository<TestEntity>(TestEntity);
    mockSession = Connection.getInstance().getSession();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a node successfully', async () => {
      const testData = { name: 'Test' };
      mockSession.run.mockResolvedValueOnce({
        records: [{ 
          get: (key: string) => key === 'n' ? { properties: testData, identity: { toString: () => '1' } } : key === 'internalId' ? { toString: () => '1' } : null
        }]
      });

      const result = await repository.create(testData);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE'),
        expect.objectContaining({ props: testData })
      );
      expect(result).toEqual({ ...testData, id: '1' });
    });
  });

  describe('findById', () => {
    it('should find a node by id', async () => {
      const testData = { name: 'Test' };
      mockSession.run.mockResolvedValueOnce({
        records: [{ 
          get: (key: string) => key === 'n' ? { properties: testData, identity: { toString: () => '1' } } : null
        }]
      });

      const result = await repository.findById('1');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH'),
        expect.objectContaining({ id: '1' })
      );
      expect(result).toEqual({ ...testData, id: '1' });
    });

    it('should return null when node not found', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await repository.findById('1');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a node successfully', async () => {
      const testData = { name: 'Updated' };
      mockSession.run.mockResolvedValueOnce({
        records: [{ 
          get: (key: string) => key === 'n' ? { properties: testData, identity: { toString: () => '1' } } : null
        }]
      });

      const result = await repository.update('1', testData);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.objectContaining({ id: '1', props: testData })
      );
      expect(result).toEqual({ id: '1', ...testData });
    });

    it('should throw error when node not found', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await expect(repository.update('1', { name: 'Test' }))
        .rejects.toThrow('Node with id 1 not found');
    });
  });

  describe('delete', () => {
    it('should delete a node successfully', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await repository.delete('1');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.objectContaining({ id: '1' })
      );
    });
  });
});