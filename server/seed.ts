import { storage } from "./storage";
import { hashPassword } from "./auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { log } from "./index";

export async function seedDatabase() {
  try {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      log("Database already seeded, skipping", "seed");
      return;
    }

    log("Seeding database with sample data...", "seed");

    const password = await hashPassword("password123");

    const mary = await storage.createUser({
      username: "maryjohnson",
      email: "mary@university.edu",
      password,
      displayName: "Mary Johnson",
    });

    const alex = await storage.createUser({
      username: "alexchen",
      email: "alex@university.edu",
      password,
      displayName: "Alex Chen",
    });

    const sarah = await storage.createUser({
      username: "sarahwilliams",
      email: "sarah@university.edu",
      password,
      displayName: "Sarah Williams",
    });

    const note1 = await storage.createNote(mary.id, {
      title: "Introduction to Data Structures",
      content: `Data Structures - Comprehensive Study Notes

Arrays
An array is a collection of elements stored at contiguous memory locations. Arrays allow random access using indices and have O(1) access time for known indices.

Key operations:
- Access: O(1)
- Search: O(n) linear, O(log n) binary search on sorted arrays
- Insertion: O(n) worst case (shifting elements)
- Deletion: O(n) worst case (shifting elements)

Linked Lists
A linked list is a linear data structure where elements are stored in nodes, each pointing to the next node. Unlike arrays, linked lists don't require contiguous memory.

Types of linked lists:
- Singly linked list: Each node points to next
- Doubly linked list: Each node points to next and previous
- Circular linked list: Last node points back to first

Stacks and Queues
Stack (LIFO - Last In, First Out):
- Push: Add element to top
- Pop: Remove element from top
- Peek: View top element
- Applications: Function call management, undo operations, expression evaluation

Queue (FIFO - First In, First Out):
- Enqueue: Add to rear
- Dequeue: Remove from front
- Applications: BFS, task scheduling, print queue

Trees
A tree is a hierarchical data structure with a root node and subtrees. Binary trees have at most two children per node.

Binary Search Tree (BST):
- Left subtree values < node value
- Right subtree values > node value
- Average operations: O(log n)
- Worst case (skewed): O(n)

Hash Tables
Hash tables use a hash function to map keys to indices. They provide average O(1) lookup, insertion, and deletion.

Collision resolution strategies:
- Chaining: Store collisions in linked lists
- Open addressing: Find next available slot (linear probing, quadratic probing, double hashing)`,
      isPublic: true,
    });

    const note2 = await storage.createNote(mary.id, {
      title: "Calculus I - Limits and Derivatives",
      content: `Calculus I Study Notes - Limits and Derivatives

Limits
The limit of f(x) as x approaches a is L, written as lim(x->a) f(x) = L.

Key limit laws:
- Sum law: lim[f(x) + g(x)] = lim f(x) + lim g(x)
- Product law: lim[f(x) * g(x)] = lim f(x) * lim g(x)
- Quotient law: lim[f(x)/g(x)] = lim f(x) / lim g(x), if lim g(x) != 0

L'Hopital's Rule:
If lim f(x)/g(x) gives 0/0 or infinity/infinity, then lim f(x)/g(x) = lim f'(x)/g'(x)

Derivatives
The derivative measures the rate of change. f'(x) = lim(h->0) [f(x+h) - f(x)] / h

Basic derivative rules:
- Power rule: d/dx[x^n] = nx^(n-1)
- Sum rule: d/dx[f + g] = f' + g'
- Product rule: d/dx[fg] = f'g + fg'
- Quotient rule: d/dx[f/g] = (f'g - fg') / g^2
- Chain rule: d/dx[f(g(x))] = f'(g(x)) * g'(x)

Common derivatives:
- d/dx[sin x] = cos x
- d/dx[cos x] = -sin x
- d/dx[e^x] = e^x
- d/dx[ln x] = 1/x

Applications of Derivatives:
- Finding local maxima and minima (f'(x) = 0)
- Related rates problems
- Optimization problems
- Linear approximation`,
      isPublic: true,
    });

    const note3 = await storage.createNote(alex.id, {
      title: "Operating Systems - Process Management",
      content: `Operating Systems - Process Management Notes

Process States:
- New: Process is being created
- Ready: Process waiting for CPU
- Running: Process executing on CPU
- Waiting: Process waiting for I/O or event
- Terminated: Process finished execution

Process Control Block (PCB):
Contains process ID, state, program counter, CPU registers, memory management info, I/O status, and accounting information.

CPU Scheduling Algorithms:

1. First-Come, First-Served (FCFS)
   - Non-preemptive
   - Simple but can cause convoy effect

2. Shortest Job First (SJF)
   - Optimal average waiting time
   - Difficult to predict burst time

3. Round Robin (RR)
   - Time quantum based
   - Good for time-sharing systems

4. Priority Scheduling
   - Each process has priority
   - Can cause starvation (solution: aging)

Process Synchronization:
- Critical section problem
- Mutex locks
- Semaphores (binary and counting)
- Monitors

Deadlock:
Four necessary conditions (Coffman conditions):
1. Mutual exclusion
2. Hold and wait
3. No preemption
4. Circular wait`,
      isPublic: true,
    });

    const note4 = await storage.createNote(alex.id, {
      title: "Database Systems - SQL Fundamentals",
      content: `Database Systems - SQL Notes

SELECT Queries:
SELECT column1, column2 FROM table WHERE condition ORDER BY column ASC/DESC;

JOIN Types:
- INNER JOIN: Returns matching rows from both tables
- LEFT JOIN: All rows from left table + matching from right
- RIGHT JOIN: All rows from right table + matching from left  
- FULL OUTER JOIN: All rows from both tables

Aggregate Functions:
- COUNT(*): Number of rows
- SUM(col): Sum of values
- AVG(col): Average value
- MIN(col): Minimum value
- MAX(col): Maximum value

GROUP BY and HAVING:
SELECT department, COUNT(*) FROM employees GROUP BY department HAVING COUNT(*) > 5;

Normalization:
- 1NF: Atomic values, no repeating groups
- 2NF: 1NF + no partial dependencies
- 3NF: 2NF + no transitive dependencies
- BCNF: Every determinant is a candidate key

Indexing:
- B-tree indexes: Good for range queries
- Hash indexes: Good for equality lookups
- Composite indexes: Multiple columns
- Covering indexes: Include all needed columns`,
      isPublic: true,
    });

    const note5 = await storage.createNote(sarah.id, {
      title: "Linear Algebra - Matrices and Vectors",
      content: `Linear Algebra Study Notes

Vectors:
A vector is an ordered list of numbers. In R^n, a vector has n components.

Vector operations:
- Addition: [a1, a2] + [b1, b2] = [a1+b1, a2+b2]
- Scalar multiplication: c[a1, a2] = [ca1, ca2]
- Dot product: a . b = a1*b1 + a2*b2
- Cross product (R^3 only)

Matrices:
An m x n matrix has m rows and n columns.

Matrix operations:
- Addition: Element-wise, same dimensions required
- Multiplication: (m x n) * (n x p) = (m x p)
- Transpose: Swap rows and columns

Special matrices:
- Identity matrix: Diagonal of 1s, zeros elsewhere
- Symmetric: A = A^T
- Orthogonal: A^T * A = I

Determinant:
- 2x2: ad - bc for [[a,b],[c,d]]
- Properties: det(AB) = det(A) * det(B)
- det(A) = 0 means A is singular (not invertible)

Eigenvalues and Eigenvectors:
Av = lambda * v
- lambda is the eigenvalue
- v is the eigenvector
- Find by solving det(A - lambda*I) = 0`,
      isPublic: true,
    });

    const privateNote = await storage.createNote(mary.id, {
      title: "Personal Study Plan - Week 5",
      content: `Week 5 Study Plan (Private)

Monday: Review data structures chapters 4-5
Tuesday: Practice calculus problem sets
Wednesday: Group study session - OS concepts
Thursday: Database lab assignment
Friday: Linear algebra review

Goals for this week:
- Complete data structures assignment #3
- Start working on the midterm study guide
- Review all lecture recordings from last week`,
      isPublic: false,
    });

    const mod1 = await storage.createModule(mary.id, {
      title: "CS101 - Introduction to Computer Science",
      description: "Core computer science fundamentals including data structures, algorithms, and programming concepts.",
      isPublic: true,
      categoryLabels: ["Computer Science", "Programming", "Data Structures"],
    });

    const mod2 = await storage.createModule(alex.id, {
      title: "MATH201 - Calculus and Linear Algebra",
      description: "Mathematics foundations covering calculus, linear algebra, and their applications in engineering.",
      isPublic: true,
      categoryLabels: ["Mathematics", "Calculus", "Linear Algebra"],
    });

    const mod3 = await storage.createModule(sarah.id, {
      title: "CS301 - Operating Systems and Databases",
      description: "Advanced topics in operating systems, database management, and system design.",
      isPublic: true,
      categoryLabels: ["Operating Systems", "Databases", "Systems"],
    });

    await storage.addModuleItem(mod1.id, note1.id);
    await storage.addModuleItem(mod2.id, note2.id);
    await storage.addModuleItem(mod2.id, note5.id);
    await storage.addModuleItem(mod3.id, note3.id);
    await storage.addModuleItem(mod3.id, note4.id);

    log("Database seeded successfully!", "seed");
  } catch (err) {
    console.error("Seed error:", err);
  }
}
