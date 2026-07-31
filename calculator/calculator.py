import tkinter as tk
from tkinter import ttk, messagebox

class Calculator:
    def __init__(self, root):
        self.root = root
        self.root.title("Calculator")
        self.root.geometry("400x500")
        self.root.resizable(False, False)

        self.expression = ""
        self.result_var = tk.StringVar()
        self.result_var.set("0")

        self._create_widgets()

    def _create_widgets(self):
        style = ttk.Style()
        style.configure("TButton", font=("Segoe UI", 12), padding=10)
        style.configure("Display.TLabel", font=("Segoe UI", 24), anchor="e", padding=10)

        display = ttk.Label(
            self.root,
            textvariable=self.result_var,
            style="Display.TLabel",
            background="#2d2d2d",
            foreground="#ffffff",
        )
        display.pack(fill="both", expand=True, padx=10, pady=10)

        button_frame = ttk.Frame(self.root)
        button_frame.pack(fill="both", expand=True, padx=10, pady=10)

        buttons = [
            ["C", "⌫", "%", "÷"],
            ["7", "8", "9", "×"],
            ["4", "5", "6", "-"],
            ["1", "2", "3", "+"],
            ["±", "0", ".", "="],
        ]

        for row_idx, row in enumerate(buttons):
            for col_idx, text in enumerate(row):
                btn = ttk.Button(
                    button_frame,
                    text=text,
                    command=lambda t=text: self._on_button_click(t),
                )
                btn.grid(row=row_idx, column=col_idx, sticky="nsew", padx=2, pady=2)

            button_frame.grid_rowconfigure(row_idx, weight=1)

        for col_idx in range(4):
            button_frame.grid_columnconfigure(col_idx, weight=1)

    def _on_button_click(self, text):
        if text == "C":
            self.expression = ""
            self.result_var.set("0")
        elif text == "⌫":
            if len(self.expression) > 0:
                self.expression = self.expression[:-1]
                self._update_display()
        elif text == "=":
            self._calculate()
        elif text == "±":
            if self.expression:
                if self.expression.startswith("-"):
                    self.expression = self.expression[1:]
                else:
                    self.expression = "-" + self.expression
                self._update_display()
        elif text == "%":
            if self.expression:
                try:
                    value = float(eval(self.expression)) / 100
                    self.expression = str(value)
                    self._update_display()
                except Exception:
                    self._show_error()
        else:
            if self.expression == "" and text == "0":
                self.result_var.set("0")
                return

            operators = ["+", "-", "×", "÷"]
            if text in operators:
                if self.expression and self.expression[-1] in operators:
                    self.expression = self.expression[:-1] + self._to_symbol(text)
                else:
                    self.expression += self._to_symbol(text)
            elif text == ".":
                parts = self.expression.split("+")[-1].split("-")[-1].split("×")[-1].split("÷")[-1]
                if "." not in parts:
                    self.expression += text
            else:
                if self.result_var.get() == "0" and text.isdigit():
                    self.expression = text
                else:
                    self.expression += text

            self._update_display()

    def _to_symbol(self, text):
        mapping = {"×": "*", "÷": "/"}
        return mapping.get(text, text)

    def _to_operator(self, symbol):
        mapping = {"*": "×", "/": "÷"}
        return mapping.get(symbol, symbol)

    def _update_display(self):
        if self.expression == "":
            self.result_var.set("0")
        else:
            display_text = self.expression
            display_text = display_text.replace("*", "×").replace("/", "÷")
            self.result_var.set(display_text)

    def _calculate(self):
        if not self.expression:
            return

        try:
            result = eval(self.expression)

            if isinstance(result, float) and result.is_integer():
                result = int(result)

            self.expression = str(result)
            self.result_var.set(str(result))
        except ZeroDivisionError:
            self._show_error("Cannot divide by zero")
        except Exception:
            self._show_error("Invalid expression")

    def _show_error(self, message="Error"):
        self.result_var.set(message)
        self.expression = ""
        self.root.after(1500, lambda: self.result_var.set("0"))


if __name__ == "__main__":
    root = tk.Tk()
    app = Calculator(root)
    root.mainloop()
