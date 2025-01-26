import { Node, Property } from '../../decorators';
import { User } from './user.entity';

@Node('Post')
export class Post {
  @Property({ type: 'neo4j_internal_id', readOnly: true })
  id!: string;

  @Property()
  title!: string;

  @Property()
  content!: string;

  @Property()
  authorId!: string;

  @Property()
  createdAt: Date;

  constructor() {
    this.createdAt = new Date();
  }
}