import type { ReactNode } from 'react';
import { SQLiteProvider } from 'expo-sqlite';

import { DATABASE_NAME, initializeDatabase } from './database';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      options={{ enableChangeListener: true }}
      onInit={initializeDatabase}
      onError={(error) => {
        console.error('Vidora database error:', error.message);
      }}>
      {children}
    </SQLiteProvider>
  );
}
