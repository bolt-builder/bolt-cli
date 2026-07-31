#!/usr/bin/env python3
"""Calculator GUI application using tkinter."""

import sys
import os

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, script_dir)

    from calculator import Calculator
    import tkinter as tk

    root = tk.Tk()
    app = Calculator(root)
    root.mainloop()
