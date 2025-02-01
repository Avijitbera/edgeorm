import { Node, Property } from '../../decorators';
import { RelationshipManager } from '../../relationships';
import { Repository } from '../../repository';

@Node('Category')
export class Category {
  @Property({ type: 'neo4j_internal_id' })
  id!: string;

  @Property()
  name!: string;

  @Property()
  description?: string;
}

@Node('Product')
export class Product {
  @Property({ type: 'neo4j_internal_id' })
  id!: string;

  @Property()
  name!: string;

  @Property()
  price!: number;

  @Property()
  tags?: string[];
}

// Define relationship properties with advanced types and validation
interface BelongsToProperties {
  position: number;
  metadata: {
    addedDate: Date;
    featured: boolean;
  };
  customTags: string[];
}

// Register the relationship with advanced property types and validation
RelationshipManager.registerRelationship({
  name: 'BELONGS_TO',
  type: 'BELONGS_TO',
  properties: [
    {
      name: 'position',
      type: 'number',
      required: true,
      constraints: {
        min: 1,
        max: 100
      }
    },
    {
      name: 'metadata',
      type: 'object',
      required: true,
      objectSchema: {
        addedDate: { name: 'addedDate', type: 'date', required: true },
        featured: { name: 'featured', type: 'boolean', required: true }
      }
    },
    {
      name: 'customTags',
      type: 'array',
      required: false,
      arrayType: 'string',
      constraints: {
        minLength: 0,
        maxLength: 5
      }
    }
  ]
});

// Example usage demonstrating advanced features
export async function demonstrateAdvancedRelationships() {
  const categoryRepo = new Repository(Category);
  const productRepo = new Repository(Product);
  const relationshipManager = new RelationshipManager();

  // Create categories
  const electronics = await categoryRepo.create({
    name: 'Electronics',
    description: 'Electronic devices and accessories'
  });

  const computers = await categoryRepo.create({
    name: 'Computers',
    description: 'Laptops, desktops, and accessories'
  });

  // Create products
  const laptop = await productRepo.create({
    name: 'Gaming Laptop',
    price: 1299.99,
    tags: ['gaming', 'laptop', 'high-performance']
  });

  // Create relationships with advanced properties
  await relationshipManager.createRelationship<Product, Category, BelongsToProperties>(
    laptop,
    electronics,
    {
      type: 'BELONGS_TO',
      properties: {
        position: 1,
        metadata: {
          addedDate: new Date(),
          featured: true
        },
        customTags: ['new', 'trending']
      }
    }
  );

  // Demonstrate path traversal
  const productCategories = await relationshipManager.traversePath(laptop, {
    maxDepth: 2,
    relationshipTypes: ['BELONGS_TO'],
    nodeLabels: ['Category'],
    orderBy: 'name',
    order: 'ASC'
  });

  return productCategories;
}