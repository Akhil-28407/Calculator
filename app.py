from flask import Flask, request, jsonify, render_template
import ast
import operator as op
import math

app = Flask(__name__)

OPS = {
    ast.Add:  op.add,
    ast.Sub:  op.sub,
    ast.Mult: op.mul,
    ast.Div:  op.truediv,
    ast.Mod:  op.mod,
    ast.Pow:  op.pow,
    ast.FloorDiv: op.floordiv,
    ast.USub: lambda x: -x,
    ast.UAdd: lambda x: +x,
}

# Allowed names / functions
SAFE_NAMES = {
    "pi": math.pi,
    "e": math.e,
    "abs": abs,
    "round": round,
    "floor": math.floor,
    "ceil": math.ceil,
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": lambda x, b=10: math.log(x, b),
    "ln": math.log,  # natural log
}

def _factorial(n):
    if int(n) != n or n < 0 or n > 2000:
        raise ValueError("Factorial expects a non-negative integer ≤ 2000.")
    return math.factorial(int(n))

def safe_eval(expr: str):
    """
    Safely evaluate a math expression using AST with a whitelist.
    Supports: +, -, *, /, //, %, **, parentheses, unary +/-,
              functions in SAFE_NAMES, constants (pi, e),
              factorial using postfix ! (handled by pre-processing).
    """
    # Tiny pre-processor: turn `x!` into `fact(x)` while respecting nested parens and numbers.
    def inject_factorial(s: str) -> str:
        out = []
        i = 0
        while i < len(s):
            if s[i] == '!':
                # Replace immediate factorial with fact(<previous term>)
                # Find the previous token bounds
                j = len(out) - 1
                if j < 0:
                    raise ValueError("Invalid factorial position.")
                # If previous char is ')', rewind to matching '('
                if out[j] == ')':
                    depth = 1
                    j -= 1
                    while j >= 0 and depth:
                        if out[j] == ')': depth += 1
                        elif out[j] == '(': depth -= 1
                        j -= 1
                    start = j + 1
                    out.insert(start, "fact(")
                    out.append(")")
                else:
                    # rewind through number/identifier
                    k = j
                    while k >= 0 and (out[k].isalnum() or out[k] == '.' or out[k] == '_'):
                        k -= 1
                    start = k + 1
                    out.insert(start, "fact(")
                    out.append(")")
                i += 1
                continue
            out.append(s[i])
            i += 1
        return "".join(out)

    def _eval(node):
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return node.value
            raise ValueError("Only numbers are allowed.")
        if isinstance(node, ast.Num):  # Py ≤3.7
            return node.n
        if isinstance(node, ast.BinOp):
            if type(node.op) not in OPS:
                raise ValueError("Operator not allowed.")
            return OPS[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp):
            if type(node.op) not in OPS:
                raise ValueError("Unary operator not allowed.")
            return OPS[type(node.op)](_eval(node.operand))
        if isinstance(node, ast.Name):
            if node.id in SAFE_NAMES and isinstance(SAFE_NAMES[node.id], (int, float)):
                return SAFE_NAMES[node.id]
            raise ValueError(f"Unknown name: {node.id}")
        if isinstance(node, ast.Call):
            # Only simple names, no attribute access
            if not isinstance(node.func, ast.Name) or node.func.id not in SAFE_NAMES:
                raise ValueError("Function not allowed.")
            func = SAFE_NAMES[node.func.id]
            args = [_eval(a) for a in node.args]
            kwargs = {kw.arg: _eval(kw.value) for kw in node.keywords}
            return func(*args, **kwargs)
        raise ValueError("Invalid expression.")

    try:
        expr = expr.strip()
        if not expr:
            raise ValueError("Empty expression.")
        # Add factorial as a permitted function (postfix handled earlier)
        SAFE_NAMES["fact"] = _factorial
        prepared = inject_factorial(expr)
        tree = ast.parse(prepared, mode='eval')
        value = _eval(tree.body)
        # Normalize floats close to int
        if isinstance(value, float):
            if math.isfinite(value) and abs(value - round(value)) < 1e-12:
                value = int(round(value))
        return value
    except ZeroDivisionError:
        raise
    except Exception as e:
        # Hide internal details
        raise ValueError("Unable to parse expression.")

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/calc", methods=["POST"])
def calc():
    data = request.get_json(silent=True) or {}
    expr = (data.get("expression") or "").strip()
    if not expr:
        return jsonify({"ok": False, "error": "No expression provided."}), 400
    try:
        result = safe_eval(expr)
        # Round for display (client can show full precision if desired)
        return jsonify({"ok": True, "result": result})
    except ZeroDivisionError:
        return jsonify({"ok": False, "error": "Division by zero."}), 400
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True)
