import { Driver, Session, auth, driver as createDriver } from 'neo4j-driver';

export interface ConnectionConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

export class Connection {
  private static instance: Connection;
  private driver: Driver | null = null;

  private constructor() {}

  static getInstance(): Connection {
    if (!Connection.instance) {
      Connection.instance = new Connection();
    }
    return Connection.instance;
  }

  async connect(config: ConnectionConfig): Promise<void> {
    if (this.driver) {
      throw new Error('Connection already established');
    }

    try {
      // Use the URI as provided without modification
      this.driver = createDriver(
        config.uri,
        auth.basic(config.username, config.password),
        // {
        //   maxConnectionPoolSize: 50,
        //   connectionTimeout: 30000,
        //   maxTransactionRetryTime: 30000,
        //   encrypted: true,
        //   trust: 'TRUST_ALL_CERTIFICATES',
          
        // }
      );

      // Verify connection
      // await this.driver.verifyConnectivity();
      const info = await this.driver.getServerInfo();
      console.log({info})
    } catch (error) {
      throw new Error(`Failed to connect to Neo4j: ${error}`);
    }
  }

  getSession(database?: string): Session {
    if (!this.driver) {
      throw new Error('Not connected to Neo4j');
    }

    return this.driver.session({
      database: database
    });
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}