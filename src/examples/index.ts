import { Connection, ConnectionConfig } from '../connection';
import { Repository } from '../repository';
import { User } from './entities/user.entity';
import { Post } from './entities/post.entity';
import dotenv from 'dotenv'




dotenv.config()
async function main() {
  // Initialize connection
  const uri = process.env.NEO4J_HOST || ""
  const user = process.env.NEO4J_USER || ""
  const pass = process.env.NEO4J_PASSWORD || ""
  
  
  const config: ConnectionConfig = {
    uri: uri!,
    username: user!,
    password: pass!
  };

  try {
    // Connect to Neo4j
    const connection = Connection.getInstance();
    await connection.connect(config);

    // Initialize repositories
    const userRepo = new Repository<User>(User);
    const postRepo = new Repository<Post>(Post);

    // Create a user
    const user = await userRepo.create({
      username: 'john_doe',
      email: 'john@example.com'
    });
    console.log('Created user:', user);

    // Create a post for the user
    const post = await postRepo.create({
      title: 'My First Post',
      content: 'Hello, Neo4j!',
      authorId: user.id
    });
    console.log('Created post:', post);

    // Find user by ID
    const foundUser = await userRepo.findById(user.id);
    console.log('Found user:', foundUser);

    // Update post
    const updatedPost = await postRepo.update(post.id, {
      title: 'Updated Title'
    });
    console.log('Updated post:', updatedPost);

    // Delete post
    await postRepo.delete(post.id);
    console.log('Post deleted successfully');

    // Cleanup
    await userRepo.delete(user.id);
    console.log('User deleted successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from Neo4j
    const connection = Connection.getInstance();
    await connection.disconnect();
  }
}

// Run the example
main().catch(console.error);