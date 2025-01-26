import { RelationshipManager } from '../relationships';
import { Connection } from '../connection';
import { Node, Property } from '../decorators';

@Node('Person')
class Person {
  @Property({ type: 'neo4j_internal_id' })
  id!: string;

  @Property()
  name!: string;

  @Property()
  age!: number;
}

@Node('Movie')
class Movie {
  @Property({ type: 'neo4j_internal_id' })
  id!: string;

  @Property()
  title!: string;

  @Property()
  year!: number;
}

describe('RelationshipManager', () => {
  let relationshipManager: RelationshipManager;
  let mockSession: any;
  let mockRun: jest.Mock;
  let mockClose: jest.Mock;

  beforeEach(() => {
    mockRun = jest.fn();
    mockClose = jest.fn();
    mockSession = {
      run: mockRun,
      close: mockClose
    };

    const mockConnection = {
      getSession: jest.fn().mockReturnValue(mockSession)
    };

    jest.spyOn(Connection, 'getInstance').mockReturnValue(mockConnection as any);
    relationshipManager = new RelationshipManager();

    // Register test relationship metadata
    RelationshipManager.registerRelationship({
      name: 'ACTED_IN',
      type: 'ACTED_IN',
      properties: [
        { name: 'role', type: 'string', required: true },
        { name: 'year', type: 'number' }
      ]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRelationship', () => {
    it('should create a relationship between nodes', async () => {
      const person = new Person();
      person.id = '1';
      person.name = 'John Doe';

      const movie = new Movie();
      movie.id = '2';
      movie.title = 'The Matrix';

      mockRun.mockResolvedValueOnce({ records: [{ get: () => ({ properties: {} }) }] });

      await relationshipManager.createRelationship(person, movie, {
        type: 'ACTED_IN',
        properties: { role: 'Neo', year: 1999 }
      });

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (source)-[r:ACTED_IN $props]->(target)'),
        expect.objectContaining({
          sourceId: '1',
          targetId: '2',
          props: { role: 'Neo', year: 1999 }
        })
      );
    });

    it('should validate required properties', async () => {
      const person = new Person();
      person.id = '1';
      const movie = new Movie();
      movie.id = '2';

      await expect(
        relationshipManager.createRelationship(person, movie, {
          type: 'ACTED_IN',
          properties: { year: 1999 } // Missing required 'role' property
        })
      ).rejects.toThrow("Required property 'role' is missing");
    });

    it('should validate property types', async () => {
      const person = new Person();
      person.id = '1';
      const movie = new Movie();
      movie.id = '2';

      await expect(
        relationshipManager.createRelationship(person, movie, {
          type: 'ACTED_IN',
          properties: { role: 123, year: '1999' } // Wrong types
        })
      ).rejects.toThrow("Property 'role' must be a string");
    });
  });

  describe('findRelatedNodes', () => {
    it('should find related nodes with query options', async () => {
      const person = new Person();
      person.id = '1';

      const mockRecord = {
        get: (key: string) => {
          switch (key) {
            case 'target':
              return { properties: { title: 'The Matrix', year: 1999 } };
            case 'targetId':
              return '2';
            case 'r':
              return { properties: { role: 'Neo' } };
            default:
              return null;
          }
        }
      };

      mockRun.mockResolvedValueOnce({ records: [mockRecord] });

      const result = await relationshipManager.findRelatedNodes(
        person,
        'ACTED_IN',
        'Movie',
        { orderBy: 'year', order: 'DESC', limit: 10 }
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '2',
        title: 'The Matrix',
        year: 1999,
        relationship: { role: 'Neo' }
      });

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY target.year DESC'),
        expect.objectContaining({ sourceId: '1' })
      );
    });
  });

  describe('deleteRelationship', () => {
    it('should delete a relationship between nodes', async () => {
      const person = new Person();
      person.id = '1';
      const movie = new Movie();
      movie.id = '2';

      mockRun.mockResolvedValueOnce({ records: [] });

      await relationshipManager.deleteRelationship(person, movie, 'ACTED_IN');

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('DELETE r'),
        expect.objectContaining({
          sourceId: '1',
          targetId: '2'
        })
      );
    });
  });
});