"""
Utility functions for CI/CD environments.
Detects if running in CI and provides helpers for reducing verbosity.
"""
import os

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

