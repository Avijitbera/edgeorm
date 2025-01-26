import { Node, Property } from '../../decorators';
import { RelationshipManager, RelationshipMetadata, PropertyMetadata } from '../../relationships';
import { Repository } from '../../repository';

@Node('Person')
export class Person {
  @Property({ type: 'neo4j_internal_id' })
  id!: string;

  @Property()
  name!: string;

  @Property()
  age!: number;
}

@Node('Movie')
export class Movie {
  @Property({ type: 'neo4j_internal_id' })
  id!: string;

  @Property()
  title!: string;

  @Property()
  year!: number;
}

// Define the ActedIn relationship properties with type safety
interface ActedInProperties {
  role: string; // Required property
  performanceRating?: number; // Optional property
}

// Register the relationship with its metadata
RelationshipManager.registerRelationship({
  name: 'ACTED_IN',
  type: 'ACTED_IN',
  properties: [
    { name: 'role', type: 'string', required: true },
    { name: 'performanceRating', type: 'number', required: false }
  ]
});

// Example usage with type safety
export async function createMovieRelationship() {
  const personRepo = new Repository(Person);
  const movieRepo = new Repository(Movie);
  const relationshipManager = new RelationshipManager();

  // Create a person
  const actor = await personRepo.create({
    name: 'Tom Hanks',
    age: 66
  });

  // Create a movie
  const movie = await movieRepo.create({
    title: 'Forrest Gump',
    year: 1994
  });

  // Create a type-safe relationship
  await relationshipManager.createRelationship<Person, Movie, ActedInProperties>(
    actor,
    movie,
    {
      type: 'ACTED_IN',
      properties: {
        role: 'Forrest Gump', // Type-safe: must be string
        performanceRating: 9.5 // Type-safe: must be number,
        
      }
    }
  );

  // Find related movies for the actor
  const actorMovies = await relationshipManager.findRelatedNodes<Person>(
    actor,
    'ACTED_IN',
    'Movie',
    { orderBy: 'year', order: 'DESC' }
  );

  return actorMovies;
}