# Comprehensive Feature Demonstration

## Introduction

This narrative demonstrates **all** markdown features supported by the Narrative Studio, including *emphasis*, ***bold italic***, and ~~strikethrough~~.

---

## Section 1: Text Formatting

### Blockquotes

> "The only way to do great work is to love what you do."
>
> — Steve Jobs

### Lists

**Unordered:**

- Item 1
- Item 2
  - Nested item
  - Another nested item
- Item 3

**Ordered:**

1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

**Task List:**

- [x] Completed task
- [ ] Pending task
- [ ] Another pending task

---

## Section 2: Code

### Inline Code

Use `const x = 10;` for variable declaration in JavaScript.

### Code Blocks

```javascript
// Fibonacci sequence generator
function* fibonacci() {
  let [prev, curr] = [0, 1];
  while (true) {
    yield curr;
    [prev, curr] = [curr, prev + curr];
  }
}

const fib = fibonacci();
console.log([...Array(10)].map(() => fib.next().value));
```

```python
# Python example
class BinaryTree:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None

    def insert(self, value):
        if value < self.value:
            if self.left is None:
                self.left = BinaryTree(value)
            else:
                self.left.insert(value)
        else:
            if self.right is None:
                self.right = BinaryTree(value)
            else:
                self.right.insert(value)
```

---

## Section 3: Tables

| Feature | Syntax | Example |
|---------|--------|---------|
| Bold | `**text**` | **bold** |
| Italic | `*text*` | *italic* |
| Code | `` `code` `` | `code` |
| Link | `[text](url)` | [Google](https://google.com) |

### Alignment

| Left | Center | Right |
|:-----|:------:|------:|
| A    | B      | C     |
| 1    | 2      | 3     |

---

## Section 4: Mathematics

### Inline Math

The Pythagorean theorem: $a^2 + b^2 = c^2$

Einstein's mass-energy equivalence: $E = mc^2$

### Display Math (Double Dollar)

The integral of $e^x$:

$$
\int e^x \, dx = e^x + C
$$

Taylor series expansion:

$$
f(x) = f(a) + f'(a)(x-a) + \frac{f''(a)}{2!}(x-a)^2 + \frac{f'''(a)}{3!}(x-a)^3 + \cdots
$$

### Display Math (Bracket Notation)

The Cauchy-Riemann equations:

\[
\frac{\partial u}{\partial x} = \frac{\partial v}{\partial y}, \quad \frac{\partial u}{\partial y} = -\frac{\partial v}{\partial x}
\]

Bayes' theorem:

\[
P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}
\]

### Complex Equations

The Navier-Stokes equation:

$$
\rho\left(\frac{\partial \mathbf{v}}{\partial t} + \mathbf{v} \cdot \nabla \mathbf{v}\right) = -\nabla p + \mu \nabla^2 \mathbf{v} + \mathbf{f}
$$

---

## Section 5: Links and Images

### Links

- [OpenAI](https://openai.com)
- [Anthropic](https://anthropic.com)
- [GitHub](https://github.com)

### Reference Links

This is a [reference link][1] and this is [another one][2].

[1]: https://example.com
[2]: https://example.org

---

## Conclusion

This comprehensive narrative tests all rendering capabilities including:

✓ Headings (H1-H6)
✓ Text formatting (bold, italic, strikethrough)
✓ Lists (ordered, unordered, nested, tasks)
✓ Blockquotes
✓ Code blocks with syntax highlighting
✓ Tables with alignment
✓ Inline math ($...$)
✓ Display math ($$...$$ and \[...\])
✓ Links
✓ Horizontal rules

If this renders correctly, the Narrative Studio's markdown system is fully functional!
