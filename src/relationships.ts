import { Node } from './decorators';
import { Connection } from './connection';
import { Session } from 'neo4j-driver';

export interface RelationshipMetadata<T = any> {
  name: string;
  type: string;
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  properties?: PropertyMetadata[];
}

export interface PropertyMetadata {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
  defaultValue?: any;
}

type PropertyType<T> = T extends 'string' ? string :
  T extends 'number' ? number :
  T extends 'boolean' ? boolean :
  T extends 'date' ? Date :
  T extends 'timestamp' ? number :
  T extends 'datetime' ? Date :
  T extends 'buffer' ? Buffer :
  T extends string ? any : never;

type RelationshipProperties<T extends PropertyMetadata[]> = {
  [P in T[number] as P['name']]: P['required'] extends true
    ? PropertyType<P['type']>
    : PropertyType<P['type']> | undefined;
};

export interface RelationshipConfig<P extends PropertyMetadata[] = PropertyMetadata[]> {
  type: string;
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  properties?: RelationshipProperties<P>;
}

export interface RelationshipQueryOptions {
  limit?: number;
  skip?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}

export interface BidirectionalRelationshipConfig extends RelationshipConfig {
  inverse?: {
    type: string;
    properties?: Record<string, any>;
  };
}

export interface PathTraversalOptions extends RelationshipQueryOptions {
  maxDepth?: number;
  relationshipTypes?: string[];
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  nodeLabels?: string[];
}

export class RelationshipManager {
  private readonly connection: Connection;
  private static relationshipMetadata = new Map<string, RelationshipMetadata>();

  constructor() {
    this.connection = Connection.getInstance();
  }

  private validateProperties(properties: any, metadata: PropertyMetadata[]): void {
    for (const prop of metadata) {
      const value = properties[prop.name];

      // Check for required properties
      if (prop.required && (value === undefined || value === null)) {
        throw new Error(`Required property '${prop.name}' is missing`);
      }

      // Skip validation for undefined or null values if property is not required
      if (value === undefined || value === null) {
        continue;
      }

      // Validate property type
      switch (prop.type) {
        case 'string':
          if (typeof value !== 'string') {
            throw new Error(`Property '${prop.name}' must be a string, got ${typeof value}`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`Property '${prop.name}' must be a valid number, got ${typeof value}`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            throw new Error(`Property '${prop.name}' must be a boolean, got ${typeof value}`);
          }
          break;
        case 'date':
          if (!(value instanceof Date) || isNaN(value.getTime())) {
            throw new Error(`Property '${prop.name}' must be a valid Date object`);
          }
          break;
        default:
          throw new Error(`Unsupported property type: ${prop.type}`);
      }

      // Apply default value if provided and value is undefined
      if (value === undefined && prop.defaultValue !== undefined) {
        properties[prop.name] = prop.defaultValue;
      }
    }
  }

  static registerRelationship(metadata: RelationshipMetadata): void {
    RelationshipManager.relationshipMetadata.set(metadata.name, metadata);
  }

  static getRelationshipMetadata(name: string): RelationshipMetadata | undefined {
    return RelationshipManager.relationshipMetadata.get(name);
  }

  private getSession(): Session {
    return this.connection.getSession();
  }

  async createRelationship<T, U, P = any>(
    sourceNode: T,
    targetNode: U,
    config: RelationshipConfig<P extends PropertyMetadata[] ? P : PropertyMetadata[]>
  ): Promise<void> {
    const session = this.getSession();
    const sourceMetadata = Reflect.getMetadata('nodeLabel', (sourceNode as object).constructor);
    const targetMetadata = Reflect.getMetadata('nodeLabel', (targetNode as object).constructor);

    try {
      const cypher = `
        MATCH (source:${sourceMetadata}), (target:${targetMetadata})
        WHERE ID(source) = toInteger($sourceId) AND ID(target) = toInteger($targetId)
        CREATE (source)-[r:${config.type} $props]->(target)
        RETURN r
      `;

      const metadata = RelationshipManager.getRelationshipMetadata(config.type);
      if (metadata) {
        this.validateProperties(config.properties || {}, metadata.properties || []);
      }

      await session.run(cypher, {
        sourceId: (sourceNode as any).id,
        targetId: (targetNode as any).id,
        props: config.properties || {}
      });
    } finally {
      await session.close();
    }
  }

  async createBidirectionalRelationship<T, U, P = any>(
    sourceNode: T,
    targetNode: U,
    config: BidirectionalRelationshipConfig
  ): Promise<void> {
    const session = this.getSession();
    const sourceMetadata = Reflect.getMetadata('nodeLabel', (sourceNode as object).constructor);
    const targetMetadata = Reflect.getMetadata('nodeLabel', (targetNode as object).constructor);

    try {
      const cypher = `
        MATCH (source:${sourceMetadata}), (target:${targetMetadata})
        WHERE ID(source) = toInteger($sourceId) AND ID(target) = toInteger($targetId)
        CREATE (source)-[r1:${config.type} $props]->(target)
        ${config.inverse ? `CREATE (target)-[r2:${config.inverse.type} $inverseProps]->(source)` : ''}
        RETURN r1${config.inverse ? ', r2' : ''}
      `;

      const metadata = RelationshipManager.getRelationshipMetadata(config.type);
      if (metadata) {
        this.validateProperties(config.properties || {}, metadata.properties || []);
      }

      await session.run(cypher, {
        sourceId: (sourceNode as any).id,
        targetId: (targetNode as any).id,
        props: config.properties || {},
        inverseProps: config.inverse?.properties || {}
      });
    } finally {
      await session.close();
    }
  }

  async traversePath<T>(
    startNode: T,
    options: PathTraversalOptions = {}
  ): Promise<Array<{
    nodes: Array<{ id: string; labels: string[]; properties: any }>;
    relationships: Array<{ type: string; properties: any }>
  }>> {
    const session = this.getSession();
    const startNodeMetadata = Reflect.getMetadata('nodeLabel', (startNode as object).constructor);

    try {
      const relationshipDirection = options.direction === 'INCOMING' ? '<-' : 
                                   options.direction === 'BOTH' ? '-' : 
                                   '->';
      const relationshipPattern = options.relationshipTypes?.length ?
        `[*${options.maxDepth ? `..${options.maxDepth}` : ''} r:${options.relationshipTypes.join('|')}]` :
        `[*${options.maxDepth ? `..${options.maxDepth}` : ''} r]`;
      
      const nodePattern = options.nodeLabels?.length ?
        `(target:${options.nodeLabels.join('|')})` :
        '(target)';

      const cypher = `
        MATCH path = (source:${startNodeMetadata})${relationshipDirection}${relationshipPattern}${relationshipDirection}${nodePattern}
        WHERE ID(source) = toInteger($sourceId)
        RETURN path
        ${options.orderBy ? `ORDER BY target.${options.orderBy} ${options.order || 'ASC'}` : ''}
        ${options.limit ? `LIMIT ${options.limit}` : ''}
      `;

      const result = await session.run(cypher, {
        sourceId: (startNode as any).id
      });

      return result.records.map(record => {
        const path = record.get('path');
        return {
          nodes: path.segments.map((segment: any) => ({
            id: segment.end.identity.toString(),
            labels: segment.end.labels,
            properties: segment.end.properties
          })),
          relationships: path.segments.map((segment: any) => ({
            type: segment.relationship.type,
            properties: segment.relationship.properties
          }))
        };
      });
    } finally {
      await session.close();
    }
  }

  async findRelatedNodes<T, P = any>(
    sourceNode: T,
    relationshipType: string,
    targetLabel: string,
    options: RelationshipQueryOptions = {}
  ): Promise<Array<{ id: string } & P>> {
    const session = this.getSession();
    const sourceMetadata = Reflect.getMetadata('nodeLabel', (sourceNode as object).constructor);
  
    try {
      const orderClause = options.orderBy
        ? `ORDER BY target.${options.orderBy} ${options.order || 'ASC'}`
        : '';
      const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
      const skipClause = options.skip ? `SKIP ${options.skip}` : '';
  
      const cypher = `
        MATCH (source:${sourceMetadata})-[r:${relationshipType}]->(target:${targetLabel})
        WHERE ID(source) = toInteger($sourceId)
        RETURN target, ID(target) as targetId, r
        ${orderClause}
        ${skipClause}
        ${limitClause}
      `;
  
      const result = await session.run(cypher, {
        sourceId: (sourceNode as any).id
      });
  
      return result.records.map(record => ({
        ...record.get('target').properties,
        id: record.get('targetId').toString(),
        relationship: record.get('r').properties
      }));
    } finally {
      await session.close();
    }
  }
  async deleteRelationship<T, U>(
    sourceNode: T,
    targetNode: U,
    relationshipType: string
  ): Promise<void> {
    const session = this.getSession();
    const sourceMetadata = Reflect.getMetadata('nodeLabel', (sourceNode as object).constructor);
    const targetMetadata = Reflect.getMetadata('nodeLabel', (targetNode as object).constructor);
  
    try {
      const cypher = `
        MATCH (source:${sourceMetadata})-[r:${relationshipType}]->(target:${targetMetadata})
        WHERE ID(source) = toInteger($sourceId) AND ID(target) = toInteger($targetId)
        DELETE r
      `;
  
      await session.run(cypher, {
        sourceId: (sourceNode as any).id,
        targetId: (targetNode as any).id
      });
    } finally {
      await session.close();
    }
  }
}



