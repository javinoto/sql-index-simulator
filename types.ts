export interface UserRow {
  id: number;
  name: string;
  age: number;
  email: string;
  avatar: string; // Placeholder color/initial
}

export interface IndexEntry {
  key: number; // The indexed value (age)
  rowId: number; // Pointer to the main table row ID
  originalIndex: number; // Index in the main data array for visualization
}

export interface BTreeNode {
  id: number;
  isLeaf: boolean;
  keys: number[]; // For internal nodes (separators)
  children: BTreeNode[]; // For internal nodes
  entries: IndexEntry[]; // For leaf nodes
  range: [number, number]; // min-max values covered by this node
  parentId?: number;
}

export enum SimulationMode {
  IDLE = 'IDLE',
  FULL_SCAN = 'FULL_SCAN',
  INDEX_SEEK = 'INDEX_SEEK',
}

export enum StepType {
  SCAN_ROW = 'SCAN_ROW',
  CHECK_NODE = 'CHECK_NODE', // Visiting a B-Tree Node
  CHECK_INTERNAL_KEY = 'CHECK_INTERNAL_KEY', // Comparing value against a separator
  TRAVERSE_EDGE = 'TRAVERSE_EDGE', // Moving down a specific path
  CHECK_ENTRY = 'CHECK_ENTRY', // Checking a specific value inside a leaf
  FETCH_ROW = 'FETCH_ROW',
  FOUND_MATCH = 'FOUND_MATCH',
  FINISHED = 'FINISHED',
}

export interface SimulationStep {
  type: StepType;
  targetId?: number; // Row Index OR Node ID
  childId?: number; // For Edge Traversal
  entryId?: number; // For highlighting specific key inside a node
  description: string;
  isMatch?: boolean;
  compareValue?: number; // For internal key comparison visualization
  compareResult?: boolean;
}

export interface QueryStats {
  rowsScanned: number;
  indexNodesVisited: number;
  timeTaken: number; // Abstract units
  resultsFound: number;
}