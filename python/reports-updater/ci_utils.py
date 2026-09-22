"""
Utility functions for CI/CD environments.
Detects if running in CI and provides helpers for reducing verbosity.
"""
import base64
import os
import numpy as np

def is_ci():
    """
    Detect if running in a CI environment.
    Checks for common CI environment variables.
    """
    return bool(
        os.getenv('CI') or 
        os.getenv('GITHUB_ACTIONS') or 
        os.getenv('GITLAB_CI') or
        os.getenv('JENKINS_URL') or
        os.getenv('TRAVIS') or
        os.getenv('CIRCLECI')
    )

def log(message, verbose=True):
    """
    Print a message only if verbose is True or not in CI.
    In CI, only essential messages are printed.
    """
    if verbose or not is_ci():
        print(message)

# Plotly >= 6 serializes numeric arrays as base64 "typed arrays"
# ({"dtype": "i2", "bdata": "..."}) instead of JSON arrays. plotly.js 1.58.5
# (what cdn.plot.ly/plotly-latest.min.js still resolves to) cannot read those,
# and the report template does data.data[0].x.map(...), so the chart and the
# click-to-details handler both break. requirements.txt pins plotly < 6, and
# this decodes the typed arrays back to plain lists if that pin ever moves.
_TYPED_ARRAY_DTYPES = {
    "i1": "int8",
    "u1": "uint8",
    "i2": "int16",
    "u2": "uint16",
    "i4": "int32",
    "u4": "uint32",
    "i8": "int64",
    "u8": "uint64",
    "f4": "float32",
    "f8": "float64",
}


def is_plotly_typed_array(obj):
    """True for a plotly base64 typed-array dict: {dtype, bdata[, shape]}."""
    return (
        isinstance(obj, dict)
        and "dtype" in obj
        and "bdata" in obj
        and isinstance(obj.get("bdata"), str)
        and set(obj).issubset({"dtype", "bdata", "shape"})
    )


def decode_plotly_typed_array(obj):
    """Decode a plotly base64 typed array into a plain (possibly nested) list."""
    dtype = _TYPED_ARRAY_DTYPES.get(obj["dtype"])
    if dtype is None:
        raise ValueError(f"Unsupported plotly typed-array dtype: {obj['dtype']!r}")
    array = np.frombuffer(base64.b64decode(obj["bdata"]), dtype=dtype)
    shape = obj.get("shape")
    if shape:
        array = array.reshape([int(dim) for dim in str(shape).split(",")])
    return array.tolist()


def convert_numpy_types(obj):
    """
    Recursively convert NumPy types to native Python types for JSON serialization.
    Handles numpy int64, float64, bool_, arrays, and other numpy types, plus the
    base64 typed arrays emitted by plotly >= 6.
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif is_plotly_typed_array(obj):
        return decode_plotly_typed_array(obj)
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    else:
        return obj

