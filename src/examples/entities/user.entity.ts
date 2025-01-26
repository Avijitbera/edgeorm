import { Node, Property } from '../../decorators';

@Node('User')
export class User {
  @Property({ type: 'neo4j_internal_id', readOnly: true })
  id!: string;

  @Property()
  username!: string;

  @Property()
  email!: string;

  @Property()
  createdAt: Date;

  constructor() {
    this.createdAt = new Date();
  }
}