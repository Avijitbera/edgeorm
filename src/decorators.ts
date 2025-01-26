import 'reflect-metadata';

export const NODE_METADATA_KEY = 'neo4j:node';
export const PROPERTY_METADATA_KEY = 'neo4j:property';

export interface NodeMetadata {
  label: string;
}

export interface PropertyMetadata {
  name?: string;
  required?: boolean;
  default?: any;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'neo4j_internal_id';
  readOnly?: boolean;
}

export function Node(label: string) {
  return function (constructor: Function) {
    Reflect.defineMetadata(NODE_METADATA_KEY, { label }, constructor);
  };
}

export function Property(options: PropertyMetadata = {}) {
  return function (target: any, propertyKey: string) {
    const properties = Reflect.getMetadata(PROPERTY_METADATA_KEY, target.constructor) || {};
    properties[propertyKey] = {
      name: options.name || propertyKey,
      required: options.required !== undefined ? options.required : true,
      default: options.default,
      type: options.type,
      readOnly: options.type === 'neo4j_internal_id' ? true : options.readOnly,
    };
    Reflect.defineMetadata(PROPERTY_METADATA_KEY, properties, target.constructor);
  };
}

export function getNodeMetadata(target: Function): NodeMetadata | undefined {
  return Reflect.getMetadata(NODE_METADATA_KEY, target);
}

export function getPropertyMetadata(target: Function): Record<string, PropertyMetadata> {
  return Reflect.getMetadata(PROPERTY_METADATA_KEY, target) || {};
}