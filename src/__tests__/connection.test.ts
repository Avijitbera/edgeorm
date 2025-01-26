import { Connection, ConnectionConfig } from '../connection';
import { Driver, Session, auth } from 'neo4j-driver';
import dotenv from 'dotenv'
dotenv.config()
// Mock neo4j-driver
jest.mock('neo4j-driver', () => {
  const mockSession = {
    run: jest.fn(),
    close: jest.fn(),
  };
  const mockDriver = {
    session: jest.fn(() => mockSession),
    verifyConnectivity: jest.fn(),
    close: jest.fn(),
    getServerInfo: jest.fn().mockResolvedValue({
      address: 'localhost:7687',
      version: '4.4.0'
    })
  };
  return {
    auth: { basic: jest.fn() },
    driver: jest.fn(() => mockDriver),
  };
});

describe('Connection', () => {
  let connection: Connection;
  const uri = process.env.NEO4J_HOST
  const user = process.env.NEO4J_USER
  const pass = process.env.NEO4J_PASSWORD
  const mockConfig: ConnectionConfig = {
    uri: uri!,
    username: user!,
    password: pass!,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Get a fresh instance
    connection = Connection.getInstance();
  });

  afterEach(async () => {
    await connection.disconnect();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = Connection.getInstance();
      const instance2 = Connection.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('connect', () => {
    it('should establish connection successfully', async () => {
      await connection.connect(mockConfig);
      expect(auth.basic).toHaveBeenCalledWith(mockConfig.username, mockConfig.password);
    });

    it('should throw error if already connected', async () => {
      await connection.connect(mockConfig);
      await expect(connection.connect(mockConfig)).rejects.toThrow('Connection already established');
    });
  });

  describe('getSession', () => {
    it('should return a session', async () => {
      await connection.connect(mockConfig);
      const session = connection.getSession();
      expect(session).toBeDefined();
    });

    it('should throw error if not connected', () => {
      expect(() => connection.getSession()).toThrow('Not connected to Neo4j');
    });
  });

  describe('disconnect', () => {
    it('should close the driver connection', async () => {
      await connection.connect(mockConfig);
      await connection.disconnect();
      const driver = require('neo4j-driver').driver();
      expect(driver.close).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(connection.disconnect()).resolves.not.toThrow();
    });
  });
});