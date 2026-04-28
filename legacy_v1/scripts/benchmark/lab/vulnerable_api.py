"""
E3: security-01 — vulnerable_api.py

This file contains 3 intentional security vulnerabilities for benchmark evaluation.
A model is asked to identify ALL security issues.

Ground truth:
  Vuln 1 (SQL injection):      `f"SELECT * FROM users WHERE id = {user_id}"` — unsanitized input
  Vuln 2 (hardcoded secret):   `SECRET_KEY = "mysecret123"` — credentials in source code
  Vuln 3 (code execution):     `eval(data['code'])` — arbitrary code execution via user input

Scorer keywords (case-insensitive, any match counts as "found"):
  vuln1: ["sql injection", "sqli", "sql", "injection", "unsanitized", "parameterized", "f-string", "format"]
  vuln2: ["hardcoded", "hard-coded", "secret key", "credentials", "mysecret", "plaintext", "source code"]
  vuln3: ["eval", "code execution", "arbitrary", "rce", "remote code", "injection", "execute"]

DO NOT FIX THIS FILE — it is a benchmark fixture.
"""

import sqlite3

# Vuln 2: Hardcoded secret — should be loaded from environment variable
SECRET_KEY = "mysecret123"


def get_user(user_id):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    # Vuln 1: SQL injection — user_id is interpolated directly into the query
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
    return cursor.fetchone()


def process_input(data):
    # Vuln 3: Arbitrary code execution — eval() on user-supplied data
    result = eval(data['code'])
    return result


def generate_token(user_id):
    import hashlib
    return hashlib.sha256(f"{user_id}{SECRET_KEY}".encode()).hexdigest()
