# E5: gen-01 — YAML Parser Specification

Write a Python function `parse_yaml(text: str) -> dict` that parses a **subset of YAML**.

## Rules

- Parse flat key-value pairs: `key: value`
- Skip blank lines and lines starting with `#` (comments)
- Strip leading/trailing whitespace from keys and values
- Values are always strings (no type coercion)
- Duplicate keys: last value wins
- Return an empty dict for empty or comment-only input

## Test Cases

The generated code must pass all 5 test cases below. The scorer runs them as pytest.

### Test 1: Basic key-value pairs

```python
result = parse_yaml("name: Alice\nage: 30\ncity: Moscow")
assert result == {"name": "Alice", "age": "30", "city": "Moscow"}
```

### Test 2: Comments and blank lines are ignored

```python
result = parse_yaml("# header comment\n\nproject: my-app\n\n# another comment\nversion: 1.0\n")
assert result == {"project": "my-app", "version": "1.0"}
```

### Test 3: Whitespace is stripped

```python
result = parse_yaml("  key1  :   value1  \n  key2:value2  ")
assert result == {"key1": "value1", "key2": "value2"}
```

### Test 4: Empty input returns empty dict

```python
result = parse_yaml("")
assert result == {}

result2 = parse_yaml("# only comments\n# nothing here")
assert result2 == {}
```

### Test 5: Duplicate keys — last value wins

```python
result = parse_yaml("color: red\nsize: large\ncolor: blue")
assert result["color"] == "blue"
assert result["size"] == "large"
```

## Scorer

The benchmark runner will:
1. Extract the first Python code block from the model's response
2. Append the 5 test cases as `test_case_N()` functions
3. Run `pytest --tb=short -q` on the combined file
4. Score = number of passing tests / 5
