"""
E1: bug-hunt-01 — fibonacci_broken.py

This file contains 3 intentional bugs for benchmark evaluation.
A model is asked to find ALL bugs in this implementation.

Ground truth:
  Bug 1 (base case): `n <= 0` returns -1 — should return 0 for n=0
                     (fib(0) = 0 by definition; negative inputs should raise, not return -1)
  Bug 2 (range):     `range(n - 2)` should be `range(n - 1)` — loop runs one iteration short
  Bug 3 (return):    `return a` should be `return b` — a holds fib(n-1), b holds fib(n)

Verification (correct fibonacci):
  fib(0)=0, fib(1)=1, fib(2)=1, fib(3)=2, fib(4)=3, fib(5)=5

Scorer keywords (case-insensitive, any match counts as "found"):
  bug1: ["n <= 0", "n<0", "base case", "returns -1", "fib(0)", "n == 0", "zero"]
  bug2: ["range(n - 2)", "range(n-2)", "n - 2", "n-2", "one short", "iteration", "off by one"]
  bug3: ["return a", "return b", "wrong variable", "fib(n-1)", "a instead"]

DO NOT FIX THIS FILE — it is a benchmark fixture.
"""


def fibonacci(n):
    if n <= 0:              # Bug 1: should handle n==0 as base case (return 0), n<0 as error
        return -1           #        currently returns -1 for all non-positive inputs
    if n == 1:
        return 1
    a, b = 0, 1
    for i in range(n - 2):  # Bug 2: should be range(n - 1) — misses one iteration
        a, b = b, a + b
    return a                # Bug 3: should be `return b` (a=fib(n-1), b=fib(n))
