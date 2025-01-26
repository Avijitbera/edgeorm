import { Session, Transaction } from 'neo4j-driver';
import { Connection } from './connection';

export class TransactionManager {
  private readonly connection: Connection;
  private currentTransaction: Transaction | null = null;

  constructor() {
    this.connection = Connection.getInstance();
  }

  async beginTransaction(): Promise<Transaction> {
    if (this.currentTransaction) {
      throw new Error('Transaction already in progress');
    }

    const session = this.connection.getSession();
    this.currentTransaction = session.beginTransaction();
    return this.currentTransaction;
  }

  async commit(): Promise<void> {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    try {
      await this.currentTransaction.commit();
    } finally {
      await this.currentTransaction.close();
      this.currentTransaction = null;
    }
  }

  async rollback(): Promise<void> {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    try {
      await this.currentTransaction.rollback();
    } finally {
      await this.currentTransaction.close();
      this.currentTransaction = null;
    }
  }

  async runInTransaction<T>(
    callback: (transaction: Transaction) => Promise<T>
  ): Promise<T> {
    const transaction = await this.beginTransaction();

    try {
      const result = await callback(transaction);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  getCurrentTransaction(): Transaction | null {
    return this.currentTransaction;
  }
}