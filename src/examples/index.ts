import { Connection, ConnectionConfig } from '../connection';
import { Repository } from '../repository';
import { User } from './entities/user.entity';
import { Post } from './entities/post.entity';
import dotenv from 'dotenv'

dotenv.config()
async function main() {
  // Initialize connection
  const uri = process.env.NEO4J_HOST || "neo4j+s://demo.neo4jlabs.com:7687";
  const user = process.env.NEO4J_USER || "neo4j";
  const pass = process.env.NEO4J_PASSWORD || "password";
  
  const config: ConnectionConfig = {
    uri: "neo4j://69bf8d54.databases.neo4j.io",
    username: "neo4j",
    password: "RL3HHINIkj9QYugy74h-eTiebkl2zSdtfBidXEss4us",
    database: 'neo4j'
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

    // Find post by ID
    const foundPost = await postRepo.findById(post.id);
    console.log('Found post:', foundPost);

    // Disconnect
    await connection.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();