import { Session } from 'neo4j-driver';
import { Connection } from './connection';
import { getNodeMetadata, getPropertyMetadata } from './decorators';

export class Repository<T> {
  private readonly connection: Connection;
  private readonly nodeType: new () => T;

  constructor(nodeType: new () => T) {
    this.connection = Connection.getInstance();
    this.nodeType = nodeType;
  }

  private getSession(): Session {
    return this.connection.getSession();
  }

  async create(data: Partial<T>): Promise<T> {
    const nodeMetadata = getNodeMetadata(this.nodeType);
    if (!nodeMetadata) {
      throw new Error('Invalid node type: missing @Node decorator');
    }

const propertyMetadata = getPropertyMetadata(this.nodeType);
    // Check if user is trying to set a read-only property
    for (const [key, metadata] of Object.entries(propertyMetadata)) {
      if (metadata.readOnly && key in data) {
        throw new Error(`Cannot set read-only property: ${key}`);
      }
    }

    const properties = getPropertyMetadata(this.nodeType);
    const session = this.getSession();

    try {
      const cypher = `
        CREATE (n:${nodeMetadata.label} $props)
        RETURN n, ID(n) as internalId
      `;

      const result = await session.run(cypher, { props: data });
      const record = result.records[0];
      const node = record.get('n');
      const internalId = record.get('internalId').toString();
      const resultData = { ...node.properties, id: internalId } as T;
      
      // Set internal ID if the entity has a property marked as neo4j_internal_id
      for (const [key, metadata] of Object.entries(properties)) {
        if (metadata.type === 'neo4j_internal_id') {
          (resultData as any)[key] = internalId;
        }
      }
      
      return resultData;
    } finally {
      await session.close();
    }
  }

  async findById(id: string): Promise<T | null> {
    const nodeMetadata = getNodeMetadata(this.nodeType);
    if (!nodeMetadata) {
      throw new Error('Invalid node type: missing @Node decorator');
    }

    const session = this.getSession();

    try {
      const cypher = `
        MATCH (n:${nodeMetadata.label})
        WHERE ID(n) = toInteger($id)
        RETURN n
      `;

      const result = await session.run(cypher, { id });
      const record = result.records[0];
      if (!record) return null;
      const node = record.get('n');
      return { ...node.properties, id: node.identity.toString() } as T;
    } finally {
      await session.close();
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const nodeMetadata = getNodeMetadata(this.nodeType);
    if (!nodeMetadata) {
      throw new Error('Invalid node type: missing @Node decorator');
    }

    const session = this.getSession();

    try {
      const cypher = `
        MATCH (n:${nodeMetadata.label})
        WHERE ID(n) = toInteger($id)
        SET n += $props
        RETURN n
      `;

      const result = await session.run(cypher, { id, props: data });
      const record = result.records[0];
      if (!record) {
        throw new Error(`Node with id ${id} not found`);
      }
      const node = record.get('n');
      return { ...node.properties, id: node.identity.toString() } as T;
    } finally {
      await session.close();
    }
  }

  async delete(id: string): Promise<void> {
    const nodeMetadata = getNodeMetadata(this.nodeType);
    if (!nodeMetadata) {
      throw new Error('Invalid node type: missing @Node decorator');
    }

    const session = this.getSession();

    try {
      const cypher = `
        MATCH (n:${nodeMetadata.label})
        WHERE ID(n) = toInteger($id)
        DELETE n
      `;

      await session.run(cypher, { id });
    } finally {
      await session.close();
    }
  }
}