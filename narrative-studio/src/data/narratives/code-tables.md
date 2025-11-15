# Technical Documentation Example

## Code Syntax Highlighting

Here's a simple TypeScript function:

```typescript
function calculateFibonacci(n: number): number {
  if (n <= 1) return n;
  return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);
}

// Usage
const result = calculateFibonacci(10);
console.log(`The 10th Fibonacci number is: ${result}`);
```

And here's some Python code:

```python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

# Example usage
numbers = [3, 6, 8, 10, 1, 2, 1]
sorted_numbers = quick_sort(numbers)
print(sorted_numbers)
```

## Tables

Here's a comparison table of programming paradigms:

| Paradigm | Key Features | Example Languages | Best For |
|----------|--------------|-------------------|----------|
| **Imperative** | Sequential steps, mutable state | C, Python, JavaScript | System programming, scripts |
| **Functional** | Pure functions, immutability | Haskell, Lisp, Erlang | Data transformation, concurrency |
| **Object-Oriented** | Encapsulation, inheritance | Java, C++, Python | Large applications, modeling |
| **Declarative** | Describe what, not how | SQL, HTML, Prolog | Data queries, markup |

## Inline Code

You can also use inline code like `const x = 42;` or `import React from 'react'` within regular text.

## Blockquote

> "Programs must be written for people to read, and only incidentally for machines to execute."
>
> — Harold Abelson, *Structure and Interpretation of Computer Programs*
