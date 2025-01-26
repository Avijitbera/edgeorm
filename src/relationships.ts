import { Node } from './decorators';
import { Connection } from './connection';
import { Session } from 'neo4j-driver';

export interface RelationshipMetadata {
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

export interface RelationshipConfig<T = any> {
  type: string;
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  properties?: Partial<T>;
}

export interface RelationshipQueryOptions {
  limit?: number;
  skip?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}

export class RelationshipManager {
  private readonly connection: Connection;
  private static relationshipMetadata = new Map<string, RelationshipMetadata>();

  constructor() {
    this.connection = Connection.getInstance();
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
    config: RelationshipConfig<P>
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

  private validateProperties(properties: any, metadata: PropertyMetadata[]): void {
    for (const prop of metadata) {
      if (prop.required && !(prop.name in properties)) {
        throw new Error(`Required property '${prop.name}' is missing`);
      }

      if (prop.name in properties) {
        const value = properties[prop.name];
        if (value !== undefined && value !== null) {
          switch (prop.type) {
            case 'string':
              if (typeof value !== 'string') throw new Error(`Property '${prop.name}' must be a string`);
              break;
            case 'number':
              if (typeof value !== 'number') throw new Error(`Property '${prop.name}' must be a number`);
              break;
            case 'boolean':
              if (typeof value !== 'boolean') throw new Error(`Property '${prop.name}' must be a boolean`);
              break;
            case 'date':
              if (!(value instanceof Date)) throw new Error(`Property '${prop.name}' must be a Date`);
              break;
          }
        }
      }
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