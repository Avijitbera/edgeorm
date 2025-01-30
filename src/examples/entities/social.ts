import { Node, Property } from '../../decorators';
import { RelationshipManager } from '../../relationships';
import { Repository } from '../../repository';

@Node('User')
export class User {
  @Property({ type: 'neo4j_internal_id' })
  id!: string;

  @Property()
  username!: string;

  @Property()
  email!: string;
}

// Define relationship properties
interface FollowsProperties {
  since: Date;
  notificationEnabled?: boolean;
}

// Register bidirectional relationship
RelationshipManager.registerRelationship({
  name: 'FOLLOWS',
  type: 'FOLLOWS',
  properties: [
    { name: 'since', type: 'date', required: true },
    { name: 'notificationEnabled', type: 'boolean', required: false }
  ]
});

// Example usage of advanced features
export async function demonstrateAdvancedFeatures() {
  const userRepo = new Repository(User);
  const relationshipManager = new RelationshipManager();

  // Create users
  const user1 = await userRepo.create({
    username: 'john_doe',
    email: 'john@example.com'
  });

  const user2 = await userRepo.create({
    username: 'jane_smith',
    email: 'jane@example.com'
  });

  const user3 = await userRepo.create({
    username: 'bob_wilson',
    email: 'bob@example.com'
  });

  // Create bidirectional follow relationships
  await relationshipManager.createBidirectionalRelationship(user1, user2, {
    type: 'FOLLOWS',
    properties: { since: new Date(), notificationEnabled: true },
    inverse: {
      type: 'FOLLOWS',
      properties: { since: new Date(), notificationEnabled: false }
    }
  });

  await relationshipManager.createBidirectionalRelationship(user2, user3, {
    type: 'FOLLOWS',
    properties: { since: new Date() },
    inverse: {
      type: 'FOLLOWS',
      properties: { since: new Date() }
    }
  });

  // Traverse the social network to find friends of friends
  const network = await relationshipManager.traversePath(user1, {
    maxDepth: 2,
    relationshipTypes: ['FOLLOWS'],
    direction: 'BOTH',
    nodeLabels: ['User'],
    orderBy: 'username',
    order: 'ASC'
  });

  return network;
}