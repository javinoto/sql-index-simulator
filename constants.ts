import { UserRow } from './types';

export const TARGET_AGE = 42;
export const TABLE_SIZE = 50;

// Generate deterministic mock data
export const GENERATED_DATA: UserRow[] = Array.from({ length: TABLE_SIZE }, (_, i) => {
  const ages = [18, 22, 25, 29, 33, 42, 55, 19, 21, 30, 42, 24, 60, 42, 31, 27, 28, 42, 50, 36];
  const names = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"];
  
  // Distribute target age specifically to ensure we have matches
  const age = (i % 7 === 0 || i === 15 || i === 33) ? TARGET_AGE : ages[i % ages.length] + (i % 3);

  return {
    id: i + 1,
    name: `${names[i % names.length]}`,
    age: age,
    email: `user${i + 1}@example.com`,
    avatar: `hsl(${(i * 137) % 360}, 70%, 50%)`
  };
});

export const QUERY_SQL = `SELECT * FROM users WHERE age = ${TARGET_AGE};`;
export const CREATE_INDEX_SQL = `CREATE INDEX idx_age ON users(age);`;
