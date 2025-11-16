"""
Utility functions for CI/CD environments.
Detects if running in CI and provides helpers for reducing verbosity.
"""
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

def convert_numpy_types(obj):
    """
    Recursively convert NumPy types to native Python types for JSON serialization.
    Handles numpy int64, float64, bool_, arrays, and other numpy types.
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    else:
        return obj

